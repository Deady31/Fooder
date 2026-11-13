-- Fooder · classement « Score communauté » (plus belles photos de plats).
-- À exécuter APRÈS 20261113000000_tracking.sql. Idempotent, ne modifie aucune migration existante.
--
-- Score = 10 points par photo publiée + 3 points par cœur reçu sur ses photos.
--  * calculé uniquement à partir des tables serveur (posts avec photo, post_likes) : aucun XP envoyé par le client ;
--  * un cœur de soi-même ne compte jamais (refusé à l'insertion ET exclu du calcul) ;
--  * un seul cœur par personne et par post (clé primaire post_id + user_id) ;
--  * posts masqués (modération) exclus ;
--  * « week » = depuis lundi 00:00, heure de Paris ; « all » = tout le temps.
-- Les cœurs n'existaient pas encore côté serveur (le fil les gardait en local) : la table post_likes est créée ici.

-- ═════════════════════════ Cœurs sur les posts ═════════════════════════
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);
-- Accélère le calcul du classement (photos visibles par auteur et par date)
create index if not exists posts_photo_author_idx on public.posts (user_id, created_at) where photo_path is not null and not hidden;

alter table public.post_likes enable row level security;

-- Chacun ne lit que ses propres cœurs (pour afficher ce qu'il a aimé) ; les totaux passent par les fonctions ci-dessous.
drop policy if exists "cœurs: les siens" on public.post_likes;
create policy "cœurs: les siens" on public.post_likes for select to authenticated using (user_id = auth.uid());
-- On ne peut aimer qu'un post visible qui n'est pas le sien
drop policy if exists "cœurs: donner" on public.post_likes;
create policy "cœurs: donner" on public.post_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_likes.post_id and not p.hidden and p.user_id <> auth.uid())
  );
drop policy if exists "cœurs: retirer" on public.post_likes;
create policy "cœurs: retirer" on public.post_likes for delete to authenticated using (user_id = auth.uid());

revoke all on public.post_likes from anon, authenticated;
grant select, delete on public.post_likes to authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;

-- Date posée par le serveur (le classement hebdomadaire en dépend)
create or replace function public.guard_post_like()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  return new;
end $$;
drop trigger if exists guard_post_like on public.post_likes;
create trigger guard_post_like before insert on public.post_likes for each row execute function public.guard_post_like();
revoke execute on function public.guard_post_like() from public, anon, authenticated;

-- ═════════════════════════ Calcul (interne) ═════════════════════════
-- Une ligne par utilisateur ayant au moins 1 point sur la période (donc au moins une photo : sans photo, pas de cœur).
-- Rang « à égalité » : même score et mêmes cœurs = même rang. Non appelable par les clients.
create or replace function public.leaderboard_rows(since timestamptz)
returns table (rank int, user_id uuid, pseudo text, avatar_id text, avatar_bg text, photos int, hearts int, score int)
language sql stable security definer set search_path = public, pg_temp as $$
  with ph as (
    select p.user_id as uid, count(*)::int as n
    from public.posts p
    where p.photo_path is not null and not p.hidden and p.created_at >= since
    group by p.user_id
  ),
  he as (
    select p.user_id as uid, count(*)::int as n
    from public.post_likes l
    join public.posts p on p.id = l.post_id
    where p.photo_path is not null and not p.hidden and l.user_id <> p.user_id and l.created_at >= since
    group by p.user_id
  ),
  agg as (
    select pr.id as uid, pr.name, pr.avatar_id, pr.avatar_bg,
           coalesce(ph.n, 0) as photos, coalesce(he.n, 0) as hearts,
           coalesce(ph.n, 0) * 10 + coalesce(he.n, 0) * 3 as score
    from public.profiles pr
    left join ph on ph.uid = pr.id
    left join he on he.uid = pr.id
  )
  select (rank() over (order by a.score desc, a.hearts desc))::int,
         a.uid, a.name, a.avatar_id, a.avatar_bg, a.photos, a.hearts, a.score
  from agg a
  where a.score > 0;
$$;
revoke execute on function public.leaderboard_rows(timestamptz) from public, anon, authenticated;

-- Début de période : « week » = lundi 00:00 heure de Paris, « all » = depuis toujours
create or replace function public.leaderboard_since(period text)
returns timestamptz language plpgsql stable set search_path = public, pg_temp as $$
begin
  if period = 'week' then
    return date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  elsif period = 'all' then
    return '-infinity'::timestamptz;
  end if;
  raise exception 'invalid period';
end $$;
revoke execute on function public.leaderboard_since(text) from public, anon, authenticated;

-- ═════════════════════════ Lecture pour les clients ═════════════════════════
-- Top N (défaut 50, max 100). Seulement des champs publics : pseudo et mascotte.
create or replace function public.leaderboard(period text, lim int default 50)
returns table (rank int, user_id uuid, pseudo text, avatar_id text, avatar_bg text, photos int, hearts int, score int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  since timestamptz := public.leaderboard_since(period);
  n int := least(greatest(coalesce(lim, 50), 1), 100);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select r.rank, r.user_id, r.pseudo, r.avatar_id, r.avatar_bg, r.photos, r.hearts, r.score
    from public.leaderboard_rows(since) r
    order by r.rank, r.pseudo, r.user_id
    limit n;
end $$;

-- Position de l'appelant. Aucune ligne s'il n'est pas classé (pas encore de photo sur la période) ; total = nombre de classés.
create or replace function public.my_rank(period text)
returns table (rank int, score int, photos int, hearts int, total int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  since timestamptz := public.leaderboard_since(period);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    with t as (select * from public.leaderboard_rows(since))
    select m.rank, m.score, m.photos, m.hearts, (select count(*)::int from t)
    from t m
    where m.user_id = auth.uid();
end $$;

revoke execute on function public.leaderboard(text, int), public.my_rank(text) from public, anon;
grant execute on function public.leaderboard(text, int), public.my_rank(text) to authenticated;
