-- Fooder · suivi d'usage avec identifiant utilisateur stable + fonctions de lecture du backoffice.
-- À exécuter APRÈS 20261112000000_anonymous.sql puis 20261112000100_events.sql. Idempotent (rejouable sans risque).
--
-- Remplace, pour la mesure, la table `events` (pseudonyme journalier) qui rendait rétention et parcours impossibles.
-- L'ancienne table et ses migrations restent en place (plus alimentées par l'appli).
--
-- Principes :
--  * les clients (connectés, comptes anonymes compris) peuvent seulement INSÉRER leurs propres lignes (user_id = auth.uid()) ;
--    aucun select / update / delete côté client ;
--  * les lectures passent par des fonctions admin_* exécutables UNIQUEMENT par service_role (route serveur /api/admin/metrics) ;
--  * created_at peut venir du client (file hors-ligne) mais est ramené à now() s'il sort de [now - 7 j ; now + 5 min] ;
--  * pas de clé étrangère vers auth.users : la purge des comptes anonymes inactifs ne doit pas fausser l'historique
--    (rétention, cohortes). À revoir avec le durcissement RGPD (delete_me).

-- ═════════════════════════ Table ═════════════════════════
create table if not exists public.app_events (
  id         bigserial primary key,
  user_id    uuid default auth.uid(),
  session_id text,
  name       text not null,
  screen     text,
  rest_id    text,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Contraintes légères (identiques à la validation de lib/tracking.ts : une ligne invalide ferait refuser tout le lot)
alter table public.app_events drop constraint if exists app_events_name_chk;
alter table public.app_events add constraint app_events_name_chk check (name ~ '^[a-z0-9_]{2,40}$');
alter table public.app_events drop constraint if exists app_events_session_chk;
alter table public.app_events add constraint app_events_session_chk check (session_id is null or session_id ~ '^[A-Za-z0-9_-]{1,64}$');
alter table public.app_events drop constraint if exists app_events_screen_chk;
alter table public.app_events add constraint app_events_screen_chk check (screen is null or char_length(screen) <= 120);
alter table public.app_events drop constraint if exists app_events_rest_chk;
alter table public.app_events add constraint app_events_rest_chk check (rest_id is null or rest_id ~ '^[A-Za-z0-9_.:-]{1,80}$');
alter table public.app_events drop constraint if exists app_events_props_chk;
alter table public.app_events add constraint app_events_props_chk check (jsonb_typeof(props) = 'object' and octet_length(props::text) < 2048);

create index if not exists app_events_user_time_idx on public.app_events (user_id, created_at);
create index if not exists app_events_name_time_idx on public.app_events (name, created_at);
create index if not exists app_events_session_idx   on public.app_events (session_id);
create index if not exists app_events_time_idx      on public.app_events (created_at);
create index if not exists app_events_rest_idx      on public.app_events (rest_id, created_at) where rest_id is not null;

-- ═════════════════════════ Droits et RLS ═════════════════════════
alter table public.app_events enable row level security;

drop policy if exists "app_events: insérer les siens" on public.app_events;
create policy "app_events: insérer les siens" on public.app_events
  for insert to authenticated
  with check (user_id = auth.uid());
-- Volontairement aucune politique select / update / delete.

revoke all on public.app_events from public, anon, authenticated;
-- user_id n'est pas insérable : il prend toujours la valeur par défaut auth.uid().
grant insert (session_id, name, screen, rest_id, props, created_at) on public.app_events to authenticated;
grant usage on sequence public.app_events_id_seq to authenticated;
grant select on public.app_events to service_role;

-- Quota anti-emballement (un client bogué ne remplit pas la base) : lignes au-delà ignorées en silence.
create table if not exists public.app_events_quota (
  user_id uuid not null,
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.app_events_quota enable row level security;
revoke all on public.app_events_quota from public, anon, authenticated;

create or replace function public.guard_app_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Paris')::date;
  cap constant int := 8000; -- lignes par utilisateur et par jour (≈ 30 h de battements de cœur)
  used int;
begin
  if uid is null then return new; end if; -- insertion serveur (service_role) : pas de quota
  insert into public.app_events_quota as q (user_id, day, n) values (uid, today, 1)
    on conflict (user_id, day) do update set n = q.n + 1
    returning q.n into used;
  if used > cap then return null; end if;
  if new.created_at is null or new.created_at > now() + interval '5 minutes' or new.created_at < now() - interval '7 days' then
    new.created_at := now();
  end if;
  return new;
end $$;
drop trigger if exists guard_app_event on public.app_events;
create trigger guard_app_event before insert on public.app_events for each row execute function public.guard_app_event();
revoke execute on function public.guard_app_event() from public, anon, authenticated;

-- ═════════════════════════ Fonctions de lecture (service_role uniquement) ═════════════════════════
-- Heure de Paris pour les découpages par jour. Battement de cœur = 15 s de temps actif.

-- Vue d'ensemble : utilisateurs, actifs, sessions, compteurs métier sur la période.
create or replace function public.admin_overview(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public, auth, pg_temp as $$
  with p as (select now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)) as since),
  u as (
    select count(*) as total,
           count(*) filter (where coalesce(is_anonymous, false)) as anonymous,
           count(*) filter (where not coalesce(is_anonymous, false)) as with_email,
           count(*) filter (where created_at >= now() - interval '7 days') as new_7d,
           count(*) filter (where created_at >= (select since from p)) as new_period
    from auth.users
  ),
  a as (
    select count(distinct user_id) filter (where created_at >= now() - interval '1 day')   as dau,
           count(distinct user_id) filter (where created_at >= now() - interval '7 days')  as wau,
           count(distinct user_id) filter (where created_at >= now() - interval '30 days') as mau,
           count(distinct user_id) filter (where created_at >= (select since from p))       as active_period
    from public.app_events
    where created_at >= least(now() - interval '30 days', (select since from p))
  ),
  s as (
    select session_id,
           extract(epoch from max(created_at) - min(created_at))::float8 as dur,
           count(*) filter (where name = 'heartbeat') * 15 as active_s
    from public.app_events
    where created_at >= (select since from p) and session_id is not null
    group by session_id
  ),
  sa as (
    select count(*) as sessions,
           coalesce(round(avg(dur)::numeric), 0) as avg_s,
           coalesce(round((percentile_cont(0.5) within group (order by dur))::numeric), 0) as median_s,
           coalesce(round(avg(active_s)::numeric), 0) as avg_active_s
    from s
  ),
  e as (
    select count(*) as events,
           count(*) filter (where name = 'swipe_like') as likes,
           count(*) filter (where name = 'swipe_pass') as passes,
           count(*) filter (where name = 'open_card') as opens,
           count(*) filter (where name = 'checkin') as checkins,
           count(*) filter (where name in ('share', 'friend_link_shared', 'friend_card_shared', 'defi_sent')) as invitations,
           count(*) filter (where name = 'friend_added') as friends_added,
           count(*) filter (where name = 'group_joined') as groups_joined,
           count(*) filter (where name = 'signup') as signups
    from public.app_events where created_at >= (select since from p)
  ),
  b as (
    select (select count(*) from public.posts where created_at >= (select since from p)) as posts,
           (select count(*) from public.posts where created_at >= (select since from p) and photo_path is not null) as photos,
           (select count(*) from public.groups where created_at >= (select since from p)) as groups_created,
           (select count(*) / 2 from public.friendships where created_at >= (select since from p)) as friendships
  )
  select jsonb_build_object(
    'users_total', u.total, 'users_anonymous', u.anonymous, 'users_email', u.with_email,
    'new_7d', u.new_7d, 'new_period', u.new_period,
    'dau', a.dau, 'wau', a.wau, 'mau', a.mau, 'active_period', a.active_period,
    'sessions', sa.sessions, 'avg_session_s', sa.avg_s, 'median_session_s', sa.median_s, 'avg_active_s', sa.avg_active_s,
    'events', e.events, 'likes', e.likes, 'passes', e.passes, 'opens', e.opens, 'checkins', e.checkins,
    'invitations', e.invitations, 'friends_added', e.friends_added, 'groups_joined', e.groups_joined, 'signups', e.signups,
    'posts', b.posts, 'photos', b.photos, 'groups_created', b.groups_created, 'friendships', b.friendships
  )
  from u, a, sa, e, b;
$$;

-- Évolution quotidienne (jours sans donnée inclus, à zéro).
create or replace function public.admin_daily(p_days int default 30)
returns table (day date, new_users int, active_users int, sessions int, events int, likes int, passes int, active_minutes int)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  with p as (
    select least(greatest(coalesce(p_days, 30), 1), 365) as n, (now() at time zone 'Europe/Paris')::date as today
  ),
  d as (
    select (p.today - g)::date as day from p, generate_series(0, p.n - 1) as g
  ),
  e as (
    select (created_at at time zone 'Europe/Paris')::date as day,
           count(distinct user_id) as au, count(distinct session_id) as se, count(*) as ev,
           count(*) filter (where name = 'swipe_like') as li,
           count(*) filter (where name = 'swipe_pass') as pa,
           count(*) filter (where name = 'heartbeat') as hb
    from public.app_events, p
    where created_at >= (p.today - p.n)::timestamp at time zone 'Europe/Paris'
    group by 1
  ),
  nu as (
    select (created_at at time zone 'Europe/Paris')::date as day, count(*) as n
    from auth.users, p
    where created_at >= (p.today - p.n)::timestamp at time zone 'Europe/Paris'
    group by 1
  )
  select d.day, coalesce(nu.n, 0)::int, coalesce(e.au, 0)::int, coalesce(e.se, 0)::int, coalesce(e.ev, 0)::int,
         coalesce(e.li, 0)::int, coalesce(e.pa, 0)::int, (coalesce(e.hb, 0) * 15 / 60)::int
  from d left join e on e.day = d.day left join nu on nu.day = d.day
  order by d.day;
$$;

-- Funnel ordonné : nb d'utilisateurs distincts qui atteignent chaque étape APRÈS l'étape précédente.
-- Étape = nom d'événement, ou « nom:écran » (ex. screen_view:/swipe). 8 étapes max. Point de départ dans la période.
create or replace function public.admin_funnel(p_steps text[], p_days int default 30)
returns table (step int, step_name text, users bigint, median_s numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with recursive
  p as (select now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)) as since),
  st as (
    select x.idx::int as idx, x.s as label,
           case when strpos(x.s, ':') > 0 then left(x.s, strpos(x.s, ':') - 1) else x.s end as ev,
           case when strpos(x.s, ':') > 0 then substr(x.s, strpos(x.s, ':') + 1) end as scr
    from unnest(p_steps[1:8]) with ordinality as x(s, idx)
  ),
  reach as (
    select 1 as idx, e.user_id, min(e.created_at) as t
    from public.app_events e
    join st on st.idx = 1 and e.name = st.ev and (st.scr is null or e.screen = st.scr)
    where e.created_at >= (select since from p) and e.user_id is not null
    group by e.user_id
    union all
    select r.idx + 1, r.user_id, nx.t
    from reach r
    join st on st.idx = r.idx + 1
    cross join lateral (
      select min(e.created_at) as t
      from public.app_events e
      where e.user_id = r.user_id and e.name = st.ev and (st.scr is null or e.screen = st.scr) and e.created_at >= r.t
    ) nx
    where nx.t is not null
  )
  select st.idx, st.label, count(r.user_id),
         round((percentile_cont(0.5) within group (order by extract(epoch from r.t - r0.t)::float8))::numeric)
  from st
  left join reach r  on r.idx = st.idx
  left join reach r0 on r0.idx = st.idx - 1 and r0.user_id = r.user_id
  group by st.idx, st.label
  order by st.idx;
$$;

-- Rétention J1 / J7 / J30 par cohorte d'arrivée (= premier jour d'activité dans app_events, heure de Paris).
-- dN = utilisateurs actifs exactement N jours après leur premier jour ; dN_eligible = utilisateurs arrivés depuis au moins N jours.
-- p_grain : 'day' ou 'week' (cohortes hebdomadaires, lundi).
create or replace function public.admin_retention(p_days int default 30, p_grain text default 'day')
returns table (cohort date, size bigint, d1 bigint, d1_eligible bigint, d7 bigint, d7_eligible bigint, d30 bigint, d30_eligible bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with p as (
    select least(greatest(coalesce(p_days, 30), 1), 365) as n, (now() at time zone 'Europe/Paris')::date as today
  ),
  first_seen as (
    select user_id, min((created_at at time zone 'Europe/Paris')::date) as d0
    from public.app_events where user_id is not null
    group by user_id
  ),
  c as (select f.* from first_seen f, p where f.d0 > p.today - p.n),
  act as (
    select distinct e.user_id, (e.created_at at time zone 'Europe/Paris')::date as d
    from public.app_events e join c on c.user_id = e.user_id
  ),
  per_user as (
    select c.user_id, c.d0,
           exists (select 1 from act where act.user_id = c.user_id and act.d = c.d0 + 1)  as r1,
           exists (select 1 from act where act.user_id = c.user_id and act.d = c.d0 + 7)  as r7,
           exists (select 1 from act where act.user_id = c.user_id and act.d = c.d0 + 30) as r30
    from c
  )
  select (case when p_grain = 'week' then date_trunc('week', d0)::date else d0 end) as cohort,
         count(*),
         count(*) filter (where r1),  count(*) filter (where d0 + 1  <= (select today from p)),
         count(*) filter (where r7),  count(*) filter (where d0 + 7  <= (select today from p)),
         count(*) filter (where r30), count(*) filter (where d0 + 30 <= (select today from p))
  from per_user
  group by 1
  order by 1 desc;
$$;

-- Écrans les plus vus, avec utilisateurs distincts et temps actif (battements de cœur).
create or replace function public.admin_top_screens(p_days int default 30, p_limit int default 15)
returns table (screen text, views bigint, users bigint, active_s bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.screen,
         count(*) filter (where e.name = 'screen_view'),
         count(distinct e.user_id) filter (where e.name = 'screen_view'),
         (count(*) filter (where e.name = 'heartbeat') * 15)::bigint
  from public.app_events e
  where e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    and e.screen is not null and e.name in ('screen_view', 'heartbeat')
  group by e.screen
  order by 2 desc, 4 desc
  limit least(greatest(coalesce(p_limit, 15), 1), 100);
$$;

-- Restos les plus likés / passés / ouverts (événements portant rest_id).
create or replace function public.admin_top_restos(p_days int default 30, p_limit int default 15)
returns table (rest_id text, likes bigint, passes bigint, opens bigint, views bigint, users bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select x.rest_id, x.likes, x.passes, x.opens, x.views, x.users
  from (
    select e.rest_id,
           count(*) filter (where e.name = 'swipe_like')  as likes,
           count(*) filter (where e.name = 'swipe_pass')  as passes,
           count(*) filter (where e.name = 'open_card')   as opens,
           count(*) filter (where e.name = 'screen_view') as views,
           count(distinct e.user_id)                      as users
    from public.app_events e
    where e.rest_id is not null
      and e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    group by e.rest_id
  ) x
  order by x.likes + x.opens + x.views desc, x.likes desc
  limit least(greatest(coalesce(p_limit, 15), 1), 100);
$$;

-- Liste des événements reçus (aide à composer un funnel).
create or replace function public.admin_event_names(p_days int default 30)
returns table (name text, events bigint, users bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.name, count(*), count(distinct e.user_id)
  from public.app_events e
  where e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
  group by e.name
  order by 2 desc
  limit 100;
$$;

-- Derniers utilisateurs actifs (pour ouvrir un parcours).
create or replace function public.admin_recent_users(p_limit int default 20)
returns table (user_id uuid, is_anonymous boolean, signed_up_at timestamptz, first_seen timestamptz, last_seen timestamptz, events bigint, sessions bigint)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  with e as (
    select ev.user_id, min(ev.created_at) as first_seen, max(ev.created_at) as last_seen,
           count(*) as events, count(distinct ev.session_id) as sessions
    from public.app_events ev
    where ev.user_id is not null and ev.created_at >= now() - interval '90 days'
    group by ev.user_id
  )
  select e.user_id, coalesce(u.is_anonymous, false), u.created_at, e.first_seen, e.last_seen, e.events, e.sessions
  from e left join auth.users u on u.id = e.user_id
  order by e.last_seen desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- Fiche d'un utilisateur (jamais l'adresse e-mail : seulement « a un e-mail »).
create or replace function public.admin_user_info(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, auth, pg_temp as $$
  select jsonb_build_object(
    'user_id', p_user,
    'exists', exists (select 1 from auth.users where id = p_user),
    'is_anonymous', (select coalesce(is_anonymous, false) from auth.users where id = p_user),
    'has_email', (select email is not null and email <> '' from auth.users where id = p_user),
    'signed_up_at', (select created_at from auth.users where id = p_user),
    'first_seen', (select min(created_at) from public.app_events where user_id = p_user),
    'last_seen', (select max(created_at) from public.app_events where user_id = p_user),
    'events', (select count(*) from public.app_events where user_id = p_user),
    'sessions', (select count(distinct session_id) from public.app_events where user_id = p_user),
    'active_s', (select count(*) * 15 from public.app_events where user_id = p_user and name = 'heartbeat')
  );
$$;

-- Timeline d'un utilisateur : N derniers événements (sans les battements de cœur, résumés dans active_s).
create or replace function public.admin_user_timeline(p_user uuid, p_limit int default 200)
returns table (created_at timestamptz, session_id text, name text, screen text, rest_id text, props jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.created_at, e.session_id, e.name, e.screen, e.rest_id, e.props
  from public.app_events e
  where e.user_id = p_user and e.name <> 'heartbeat'
  order by e.created_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;

-- Droits : personne sauf service_role (clé serveur, jamais exposée au navigateur).
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_overview(int)', 'public.admin_daily(int)', 'public.admin_funnel(text[], int)',
    'public.admin_retention(int, text)', 'public.admin_top_screens(int, int)', 'public.admin_top_restos(int, int)',
    'public.admin_event_names(int)', 'public.admin_recent_users(int)', 'public.admin_user_info(uuid)',
    'public.admin_user_timeline(uuid, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
