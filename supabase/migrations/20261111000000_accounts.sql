-- Fooder · comptes, amis, sessions de groupe, posts et photos.
-- À exécuter une fois dans Supabase > SQL Editor (projet en région UE). Idempotent autant que possible.
-- Principe : chaque table a la RLS activée ; le client n'utilise que la clé « anon » + la session de l'utilisateur.

create extension if not exists pgcrypto;

-- ═════════════════════════ Profils ═════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  friend_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  avatar_id   text not null default 'burger' check (char_length(avatar_id) <= 20),
  avatar_bg   text not null default 'bubblegum' check (char_length(avatar_bg) <= 20),
  -- Carte publique (FriendSnapshot), visible des amis uniquement
  card        jsonb not null default '{}'::jsonb check (octet_length(card::text) < 20000),
  xp          int not null default 0 check (xp >= 0),
  is_premium  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Profil créé automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data->>'name', 20), ''), 'foodie' || (10 + floor(random() * 89))::int))
  on conflict (id) do nothing;
  insert into public.user_state (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- ═════════════════════════ État synchronisé (likes, visites, XP…) ═════════════════════════
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 900000),
  updated_at timestamptz not null default now()
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═════════════════════════ Amis (relation réciproque) ═════════════════════════
create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Ajout par code d'ami (présent dans le lien / QR). Crée les deux sens et renvoie le profil de l'ami.
create or replace function public.add_friend(code text)
returns table (id uuid, name text, avatar_id text, avatar_bg text, card jsonb)
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select p.id into target from profiles p where p.friend_code = code;
  if target is null then raise exception 'unknown friend code'; end if;
  if target = auth.uid() then raise exception 'cannot add yourself'; end if;
  if (select count(*) from friendships f where f.user_id = auth.uid()) >= 500 then raise exception 'too many friends'; end if;
  insert into friendships (user_id, friend_id) values (auth.uid(), target), (target, auth.uid()) on conflict do nothing;
  return query select p.id, p.name, p.avatar_id, p.avatar_bg, p.card from profiles p where p.id = target;
end $$;

create or replace function public.remove_friend(friend uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships
  where (user_id = auth.uid() and friend_id = friend) or (user_id = friend and friend_id = auth.uid());
$$;

-- ═════════════════════════ Sessions « On mange où ? » ═════════════════════════
create table if not exists public.groups (
  id         text primary key check (id ~ '^g[a-z0-9]{16,40}$'),
  host       uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 40),
  restos     jsonb not null check (jsonb_typeof(restos) = 'array' and jsonb_array_length(restos) between 3 and 12),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  text not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_votes (
  group_id text not null references public.groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 20),
  likes    text[] not null default '{}' check (cardinality(likes) <= 12),
  at       timestamptz not null default now(),
  primary key (group_id, user_id)
);

create or replace function public.is_group_member(gid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members m where m.group_id = gid and m.user_id = auth.uid());
$$;

-- ═════════════════════════ Posts et photos ═════════════════════════
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  restaurant_id   text not null check (char_length(restaurant_id) <= 40),
  restaurant_name text not null check (char_length(restaurant_name) <= 60),
  cuisine         text not null default '' check (char_length(cuisine) <= 40),
  verdict         text not null check (verdict in ('miam', 'bof', 'atester')),
  caption         text not null default '' check (char_length(caption) <= 140),
  photo_path      text check (photo_path is null or photo_path ~ ('^' || user_id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|webp)$')),
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists posts_feed_idx on public.posts (created_at desc) where not hidden;
create index if not exists posts_restaurant_idx on public.posts (restaurant_id) where not hidden and photo_path is not null;

create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  reporter   uuid not null references public.profiles(id) on delete cascade,
  reason     text not null check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (post_id, reporter)
);

-- Auteur public d'un post (pseudo + mascotte + niveau, rien d'autre), seulement pour qui a publié.
create or replace view public.post_authors with (security_invoker = false) as
  select p.id, p.name, p.avatar_id, p.avatar_bg,
         coalesce(case when p.card->>'level' ~ '^[0-9]{1,2}$' then (p.card->>'level')::int end, 1) as level
  from public.profiles p
  where exists (select 1 from public.posts po where po.user_id = p.id and not po.hidden);

-- Suppression de compte (droit à l'effacement) : les photos sont supprimées côté client avant l'appel.
create or replace function public.delete_me()
returns void language sql security definer set search_path = public, auth, pg_temp as $$
  delete from auth.users where id = auth.uid();
$$;

-- ═════════════════════════ Row Level Security ═════════════════════════
alter table public.profiles      enable row level security;
alter table public.user_state    enable row level security;
alter table public.friendships   enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_votes   enable row level security;
alter table public.posts         enable row level security;
alter table public.reports       enable row level security;

-- Profils : soi-même et ses amis seulement
drop policy if exists "profil lisible par soi et ses amis" on public.profiles;
create policy "profil lisible par soi et ses amis" on public.profiles for select
  using (id = auth.uid() or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = profiles.id));
drop policy if exists "profil modifiable par soi" on public.profiles;
create policy "profil modifiable par soi" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "état: le sien" on public.user_state;
create policy "état: le sien" on public.user_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "amitiés: les siennes" on public.friendships;
create policy "amitiés: les siennes" on public.friendships for select using (user_id = auth.uid());

drop policy if exists "groupes: membres" on public.groups;
create policy "groupes: membres" on public.groups for select using (public.is_group_member(id) or host = auth.uid());
drop policy if exists "groupes: créer" on public.groups;
create policy "groupes: créer" on public.groups for insert with check (host = auth.uid());
drop policy if exists "groupes: supprimer" on public.groups;
create policy "groupes: supprimer" on public.groups for delete using (host = auth.uid());

drop policy if exists "membres: lire" on public.group_members;
create policy "membres: lire" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "membres: rejoindre" on public.group_members;
create policy "membres: rejoindre" on public.group_members for insert with check (user_id = auth.uid());
drop policy if exists "membres: quitter" on public.group_members;
create policy "membres: quitter" on public.group_members for delete using (user_id = auth.uid());

drop policy if exists "votes: membres" on public.group_votes;
create policy "votes: membres" on public.group_votes for select using (public.is_group_member(group_id));
drop policy if exists "votes: le sien" on public.group_votes;
create policy "votes: le sien" on public.group_votes for insert with check (user_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists "votes: modifier le sien" on public.group_votes;
create policy "votes: modifier le sien" on public.group_votes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists "posts visibles" on public.posts;
create policy "posts visibles" on public.posts for select using (not hidden or user_id = auth.uid());
drop policy if exists "posts: créer" on public.posts;
create policy "posts: créer" on public.posts for insert with check (user_id = auth.uid() and hidden = false);
drop policy if exists "posts: supprimer" on public.posts;
create policy "posts: supprimer" on public.posts for delete using (user_id = auth.uid());

drop policy if exists "signalements: créer" on public.reports;
create policy "signalements: créer" on public.reports for insert with check (reporter = auth.uid());

-- ═════════════════════════ Droits explicites (en plus de la RLS) ═════════════════════════
-- Supabase donne par défaut tous les droits à anon/authenticated sur les nouveaux objets : on resserre.
revoke all on public.post_authors from anon, authenticated;
grant select on public.post_authors to anon, authenticated;

-- Profil : seules ces colonnes sont modifiables (ni friend_code, ni is_premium, ni id)
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_id, avatar_bg, card, xp, updated_at) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Les visiteurs non connectés ne peuvent que lire les posts publics
revoke all on public.profiles, public.user_state, public.friendships, public.groups,
  public.group_members, public.group_votes, public.reports from anon;
revoke insert, update, delete on public.posts from anon;
revoke update on public.posts from authenticated;

-- Fonctions : réservées aux utilisateurs connectés
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_friend(text) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.delete_me() from public, anon;
revoke execute on function public.is_group_member(text) from public, anon;
grant execute on function public.add_friend(text), public.remove_friend(uuid), public.delete_me(), public.is_group_member(text) to authenticated;

-- ═════════════════════════ Garde-fous (triggers) ═════════════════════════
-- Un vote ne change jamais de groupe ni d'auteur
create or replace function public.lock_vote_keys()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.group_id <> old.group_id or new.user_id <> old.user_id then
    raise exception 'vote keys are immutable';
  end if;
  new.at := now();
  return new;
end $$;
drop trigger if exists lock_vote_keys on public.group_votes;
create trigger lock_vote_keys before update on public.group_votes for each row execute function public.lock_vote_keys();

-- Date de publication fixée par le serveur + plafond anti-abus (30 posts par jour)
create or replace function public.guard_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.hidden := false;
  if (select count(*) from posts p where p.user_id = new.user_id and p.created_at > now() - interval '1 day') >= 30 then
    raise exception 'daily post limit reached';
  end if;
  return new;
end $$;
drop trigger if exists guard_post on public.posts;
create trigger guard_post before insert on public.posts for each row execute function public.guard_post();

-- Plafond de signalements (20 par jour)
create or replace function public.guard_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports r where r.reporter = new.reporter and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'daily report limit reached';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists guard_report on public.reports;
create trigger guard_report before insert on public.reports for each row execute function public.guard_report();
revoke execute on function public.lock_vote_keys(), public.guard_post(), public.guard_report() from public, anon, authenticated;

-- ═════════════════════════ Stockage des photos ═════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1572864, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1572864, allowed_mime_types = array['image/jpeg', 'image/webp'];

drop policy if exists "photos: déposer dans son dossier" on storage.objects;
create policy "photos: déposer dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos: supprimer les siennes" on storage.objects;
create policy "photos: supprimer les siennes" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos: lister les siennes" on storage.objects;
create policy "photos: lister les siennes" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═════════════════════════ Temps réel (votes de groupe) ═════════════════════════
do $$ begin
  alter publication supabase_realtime add table public.group_votes;
exception when duplicate_object then null; end $$;
