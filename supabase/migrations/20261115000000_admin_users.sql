-- Fooder · backoffice : QUI sont les utilisateurs (pseudo, appareil) + répartition des appareils.
-- À exécuter APRÈS 20261113000000_tracking.sql (et accounts : profiles, posts). Idempotent (rejouable sans risque).
-- Ne modifie aucune migration existante : deux nouvelles fonctions de lecture, rien d'autre.
--
-- Confidentialité : l'adresse e-mail n'est JAMAIS renvoyée (seulement « a un e-mail »), aucune adresse IP n'est stockée.
-- Les données d'appareil viennent des propriétés de `session_start` (plateforme, navigateur… en listes fermées, voir lib/device.ts).
-- Tout est calculé sur les vraies tables app_events, profiles, posts : aucune valeur d'exemple.
-- Les valeurs d'appareil sont re-filtrées ici (liste blanche) : un client malveillant ne peut pas injecter de texte libre dans le tableau.

-- ═════════════════════════ Utilisateurs ═════════════════════════
-- Un utilisateur = un compte (auth.users, anonyme ou non) ou un identifiant présent dans app_events (compte purgé depuis).
-- Tri : dernière activité d'abord. `q` filtre sur le pseudo (contient) ou le début de l'identifiant.
-- Retour : { total, rows: [...] } (total = nombre après filtre, pour la pagination).
-- Temps actif : somme de la durée portée par chaque battement de cœur (props.s, 60 s aujourd'hui ; 15 s si absente, anciennes lignes).
create or replace function public.admin_users(lim int default 50, off int default 0, q text default null)
returns jsonb language sql stable security definer set search_path = public, auth, pg_temp as $$
  with p as (
    select least(greatest(coalesce(admin_users.lim, 50), 1), 100) as l,
           greatest(coalesce(admin_users.off, 0), 0) as o,
           nullif(trim(left(coalesce(admin_users.q, ''), 40)), '') as q
  ),
  act as (
    select e.user_id,
           min(e.created_at) as first_seen,
           max(e.created_at) as last_seen,
           count(distinct e.session_id) filter (where e.session_id is not null) as sessions,
           coalesce(sum(case when e.name = 'heartbeat'
                             then case when e.props->>'s' ~ '^[0-9]{1,4}$' then (e.props->>'s')::int else 15 end
                             else 0 end), 0) as active_s,
           count(*) filter (where e.name = 'swipe_like') as likes,
           count(*) filter (where e.name = 'swipe_pass') as passes,
           count(*) filter (where e.name = 'open_card') as opens,
           count(*) filter (where e.name = 'checkin') as checkins
    from public.app_events e
    where e.user_id is not null
    group by e.user_id
  ),
  ids as (
    select id as user_id from auth.users
    union
    select user_id from act
  ),
  pst as (
    select po.user_id, count(*) as posts, count(*) filter (where po.photo_path is not null) as photos
    from public.posts po
    group by po.user_id
  ),
  filtered as (
    select i.user_id,
           pr.name as pseudo,
           (u.id is not null) as account_exists,
           coalesce(u.is_anonymous, false) as is_anonymous,
           (u.email is not null and u.email <> '') as has_email,
           a.first_seen, a.last_seen,
           coalesce(a.sessions, 0) as sessions,
           coalesce(a.active_s, 0) as active_s,
           coalesce(a.likes, 0) as likes, coalesce(a.passes, 0) as passes,
           coalesce(a.opens, 0) as opens, coalesce(a.checkins, 0) as checkins,
           coalesce(ps.posts, 0) as posts, coalesce(ps.photos, 0) as photos
    from ids i
    left join auth.users u on u.id = i.user_id
    left join public.profiles pr on pr.id = i.user_id
    left join act a on a.user_id = i.user_id
    left join pst ps on ps.user_id = i.user_id
    cross join p
    where p.q is null
       or pr.name ilike '%' || replace(replace(replace(p.q, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
       or i.user_id::text ilike replace(replace(replace(p.q, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
  ),
  page as (
    select f.* from filtered f cross join p
    order by f.last_seen desc nulls last, f.user_id
    limit (select l from p) offset (select o from p)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pg.user_id,
        'pseudo', pg.pseudo,
        'account_exists', pg.account_exists,
        'is_anonymous', pg.is_anonymous,
        'has_email', coalesce(pg.has_email, false),
        'first_seen', pg.first_seen,
        'last_seen', pg.last_seen,
        'sessions', pg.sessions,
        'active_s', pg.active_s,
        'platform', case when d.props->>'platform' in ('ios', 'android', 'windows', 'macos', 'linux', 'autre') then d.props->>'platform' end,
        'form', case when d.props->>'form' in ('mobile', 'tablette', 'ordinateur') then d.props->>'form' end,
        'browser', case when d.props->>'browser' in ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'instagram', 'facebook', 'tiktok', 'autre') then d.props->>'browser' end,
        'installed', case d.props->>'standalone' when 'true' then true when 'false' then false end,
        'likes', pg.likes, 'passes', pg.passes, 'opens', pg.opens, 'checkins', pg.checkins,
        'posts', pg.posts, 'photos', pg.photos
      ) order by pg.last_seen desc nulls last, pg.user_id)
      from page pg
      left join lateral (
        select e.props from public.app_events e
        where e.user_id = pg.user_id and e.name = 'session_start'
        order by e.created_at desc, e.id desc
        limit 1
      ) d on true
    ), '[]'::jsonb)
  );
$$;

-- ═════════════════════════ Appareils ═════════════════════════
-- Répartition des utilisateurs actifs sur la période, d'après leur DERNIER session_start de la période.
-- « inconnu » = utilisateur actif dont le session_start ne porte pas encore l'information (ancienne version de l'appli).
create or replace function public.admin_devices(days int default 30)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with p as (select now() - make_interval(days => least(greatest(coalesce(admin_devices.days, 30), 1), 365)) as since),
  active as (
    select distinct e.user_id from public.app_events e, p where e.user_id is not null and e.created_at >= p.since
  ),
  last_start as (
    select distinct on (e.user_id) e.user_id, e.props
    from public.app_events e, p
    where e.user_id is not null and e.name = 'session_start' and e.created_at >= p.since
    order by e.user_id, e.created_at desc, e.id desc
  ),
  d as (
    select a.user_id,
           coalesce(case when ls.props->>'platform' in ('ios', 'android', 'windows', 'macos', 'linux', 'autre') then ls.props->>'platform' end, 'inconnu') as platform,
           coalesce(case when ls.props->>'browser' in ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'instagram', 'facebook', 'tiktok', 'autre') then ls.props->>'browser' end, 'inconnu') as browser,
           coalesce(case when ls.props->>'form' in ('mobile', 'tablette', 'ordinateur') then ls.props->>'form' end, 'inconnu') as form,
           case ls.props->>'standalone' when 'true' then 'installee' when 'false' then 'navigateur' else 'inconnu' end as installed
    from active a left join last_start ls on ls.user_id = a.user_id
  )
  select jsonb_build_object(
    'users', (select count(*) from d),
    'platforms', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'users', n) order by n desc, k) from (select platform as k, count(*) as n from d group by 1) x), '[]'::jsonb),
    'browsers',  coalesce((select jsonb_agg(jsonb_build_object('key', k, 'users', n) order by n desc, k) from (select browser as k, count(*) as n from d group by 1) x), '[]'::jsonb),
    'forms',     coalesce((select jsonb_agg(jsonb_build_object('key', k, 'users', n) order by n desc, k) from (select form as k, count(*) as n from d group by 1) x), '[]'::jsonb),
    'installed', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'users', n) order by n desc, k) from (select installed as k, count(*) as n from d group by 1) x), '[]'::jsonb)
  );
$$;

-- Droits : service_role uniquement (clé serveur, jamais exposée au navigateur).
do $$
declare f text;
begin
  foreach f in array array['public.admin_users(int, int, text)', 'public.admin_devices(int)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
