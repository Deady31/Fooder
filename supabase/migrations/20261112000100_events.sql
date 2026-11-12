-- Fooder · mesures d'usage minimales et anonymes.
-- À exécuter APRÈS 20261112000000_anonymous.sql. Idempotent.
--
-- Principes :
--  * les clients (utilisateurs connectés, anonymes compris) peuvent seulement INSÉRER : aucun select, update ni delete ;
--  * pas d'identifiant utilisateur stocké : seulement un pseudonyme qui change chaque jour, calculé avec un sel aléatoire
--    détruit dès le lendemain (permet de compter les actifs du jour ; ensuite, personne, propriétaire compris,
--    ne peut le recalculer ni relier deux jours) ;
--  * pas d'horodatage fourni par le client : la date est posée par le serveur ;
--  * liste blanche des événements ET des propriétés appliquée par le serveur, taille bornée, quota par utilisateur et par jour ;
--  * conservation 13 mois, appliquée à la première mesure de chaque jour (et par purge_old_events si planifiée) ;
--  * le propriétaire lit les chiffres depuis le SQL Editor via la vue events_daily.

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor      text not null default '',
  name       text not null check (name in (
               'swipe_like', 'swipe_pass', 'open_card', 'checkin', 'friend_added',
               'group_joined', 'photo_posted', 'signup', 'share')),
  props      jsonb not null default '{}'::jsonb
               check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 400)
);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_name_day_idx on public.events (name, created_at);

-- Compteur du quota quotidien (jamais lisible par les clients ; seule la journée en cours est conservée)
create table if not exists public.events_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, day)
);

-- Sel du jour (jamais lisible par les clients ; supprimé dès le lendemain)
create table if not exists public.events_salt (
  day  date primary key,
  salt text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);

alter table public.events       enable row level security;
alter table public.events_quota enable row level security;
alter table public.events_salt  enable row level security;

drop policy if exists "événements: insérer" on public.events;
create policy "événements: insérer" on public.events for insert to authenticated with check (auth.uid() is not null);
-- Volontairement aucune politique select / update / delete : le client ne peut rien lire ni modifier.

-- Droits explicites (Supabase donne tout par défaut aux nouveaux objets)
revoke all on public.events, public.events_quota, public.events_salt from anon, authenticated;
grant insert (name, props) on public.events to authenticated;

-- Propriétés autorisées par événement : copie de PROP_SCHEMA (lib/usage.ts). Le client filtre déjà, mais un client modifié
-- pourrait envoyer du texte libre ou une donnée personnelle : le serveur ne garde que les clés prévues, du bon type,
-- mots-clés courts (minuscules, chiffres, _ et -, pas de longue suite hexadécimale), nombres arrondis et bornés.
create or replace function public.clean_event_props(p_name text, p_props jsonb)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_object_agg(
      e.key,
      case when s.kind = 'number' then to_jsonb(round(greatest(-100000, least(100000, e.value::numeric)))) else e.value end
    ),
    '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p_props) = 'object' then p_props else '{}'::jsonb end) e
  join (values
    ('swipe_like', 'cuisine', 'string'), ('swipe_like', 'position', 'number'), ('swipe_like', 'distance_km', 'number'),
    ('swipe_pass', 'cuisine', 'string'), ('swipe_pass', 'position', 'number'), ('swipe_pass', 'distance_km', 'number'),
    ('open_card', 'cuisine', 'string'), ('open_card', 'from', 'string'),
    ('checkin', 'verdict', 'string'), ('checkin', 'photo', 'boolean'),
    ('friend_added', 'method', 'string'),
    ('group_joined', 'size', 'number'), ('group_joined', 'role', 'string'),
    ('photo_posted', 'verdict', 'string'),
    ('signup', 'method', 'string'),
    ('share', 'kind', 'string')
  ) as s(ev, k, kind) on s.ev = p_name and s.k = e.key and s.kind = jsonb_typeof(e.value)
  where s.kind <> 'string'
     or ((e.value #>> '{}') ~ '^[a-z0-9][a-z0-9_-]{0,23}$' and (e.value #>> '{}') !~ '^[0-9a-f]{12,}$');
$$;
revoke execute on function public.clean_event_props(text, jsonb) from public, anon, authenticated;

-- Conservation : 13 mois pour les événements ; compteurs de quota et sels : la journée en cours seulement
-- (un sel conservé permettrait de recalculer les pseudonymes d'un jour passé).
-- Appelée automatiquement à la première mesure de chaque jour ; à planifier aussi avec pg_cron (Database > Extensions)
-- pour qu'elle passe même les jours sans aucune mesure :
--   select cron.schedule('purge-events', '31 3 * * *', $$ select public.purge_old_events() $$);
create or replace function public.purge_old_events()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  n int;
begin
  with gone as (delete from public.events where created_at < now() - interval '13 months' returning 1)
  select count(*) into n from gone;
  delete from public.events_quota where day < today;
  delete from public.events_salt where day < today;
  return n;
end $$;
revoke execute on function public.purge_old_events() from public, anon, authenticated;

-- Garde-fou à l'insertion : pseudonyme du jour, date serveur, propriétés refiltrées, quota.
-- Une ligne au-delà du quota est ignorée en silence (pas d'erreur : le client ne réessaie pas en boucle).
create or replace function public.guard_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Paris')::date;
  cap constant int := 300; -- événements par utilisateur et par jour
  used int;
  day_salt text;
begin
  if uid is null then return null; end if;
  -- Première mesure du jour : nouveau sel, puis nettoyage (sels et compteurs passés, mesures de plus de 13 mois)
  insert into public.events_salt (day) values (today) on conflict (day) do nothing;
  if found then perform public.purge_old_events(); end if;
  insert into public.events_quota as q (user_id, day, n) values (uid, today, 1)
    on conflict (user_id, day) do update set n = q.n + 1
    returning q.n into used;
  if used > cap then return null; end if;
  select s.salt into day_salt from public.events_salt s where s.day = today;
  if day_salt is null then return null; end if; -- passage de minuit concurrent : mesure abandonnée
  new.created_at := now();
  new.actor := left(encode(sha256(convert_to(day_salt || ':' || uid::text, 'UTF8')), 'hex'), 16);
  new.props := public.clean_event_props(new.name, new.props);
  return new;
end $$;
drop trigger if exists guard_event on public.events;
create trigger guard_event before insert on public.events for each row execute function public.guard_event();
revoke execute on function public.guard_event() from public, anon, authenticated;

-- Vue pour le propriétaire (SQL Editor : rôle postgres). Heure de Paris. Non accessible aux clients.
-- security_invoker : même si un droit de lecture était accordé par erreur, la RLS de events s'appliquerait.
create or replace view public.events_daily with (security_invoker = true) as
  select (created_at at time zone 'Europe/Paris')::date as day,
         name,
         count(*)              as events,
         count(distinct actor) as actors
  from public.events
  group by 1, 2
  order by 1 desc, 2;
revoke all on public.events_daily from anon, authenticated;
