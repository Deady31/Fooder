-- Schéma Supabase (PostgreSQL + PostGIS) pour Fooder.
-- À exécuter dans l'éditeur SQL du projet Supabase (région UE). Toutes les tables ont la RLS activée.

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ───────── Restaurants (source OSM + enrichissements + revendication) ─────────
create table if not exists restaurants (
  id            text primary key,                -- ex. osm-n123456
  name          text not null,
  kind          text not null,                   -- amenity OSM
  cuisine       text,
  geom          geography(point, 4326) not null,
  address       text,
  website       text,
  opening_hours text,                            -- brut OSM
  photo_url     text,                            -- fournie par le restaurateur uniquement
  claimed_by    uuid references auth.users(id),
  sponsored_until timestamptz,
  source        text not null default 'osm',
  updated_at    timestamptz not null default now()
);
create index if not exists restaurants_geom_idx on restaurants using gist (geom);
create index if not exists restaurants_name_trgm on restaurants using gin (name gin_trgm_ops);

-- Restos autour d'un point, triés par distance (remplace le tri en mémoire de /api/restaurants)
create or replace function restaurants_near(lat double precision, lng double precision, radius_m int, lim int, off int)
returns table (id text, name text, cuisine text, address text, distance_m double precision)
language sql stable as $$
  select r.id, r.name, r.cuisine, r.address,
         st_distance(r.geom, st_makepoint(lng, lat)::geography) as distance_m
  from restaurants r
  where st_dwithin(r.geom, st_makepoint(lng, lat)::geography, radius_m)
  order by r.geom <-> st_makepoint(lng, lat)::geography
  limit lim offset off;
$$;

-- ───────── Profils ─────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique not null check (handle ~ '^[a-z0-9_.]{3,20}$'),
  avatar_id   text not null default 'burger',
  avatar_bg   text not null default 'bubblegum',
  level       int  not null default 1,
  is_premium  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists likes (
  user_id       uuid not null references profiles(id) on delete cascade,
  restaurant_id text not null references restaurants(id) on delete cascade,
  liked         boolean not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

-- ───────── Social ─────────
create table if not exists follows (
  follower uuid not null references profiles(id) on delete cascade,
  followee uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  restaurant_id text not null references restaurants(id) on delete cascade,
  caption       text check (char_length(caption) <= 140),
  photo_path    text,                              -- Supabase Storage, bucket "post-photos"
  hidden        boolean not null default false,    -- modération
  created_at    timestamptz not null default now()
);
create index if not exists posts_feed_idx on posts (created_at desc) where not hidden;

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  reporter   uuid not null references profiles(id) on delete cascade,
  reason     text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter)
);

-- ───────── Row Level Security ─────────
alter table restaurants enable row level security;
alter table profiles    enable row level security;
alter table likes       enable row level security;
alter table follows     enable row level security;
alter table posts       enable row level security;
alter table post_likes  enable row level security;
alter table reports     enable row level security;

create policy "restaurants lisibles" on restaurants for select using (true);

create policy "profils lisibles"   on profiles for select using (true);
create policy "profil: créer le sien" on profiles for insert with check (auth.uid() = id);
create policy "profil: modifier le sien" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and is_premium = (select p.is_premium from profiles p where p.id = auth.uid()));

create policy "likes: les siens" on likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "follows lisibles" on follows for select using (true);
create policy "follows: les siens" on follows for insert with check (auth.uid() = follower);
create policy "follows: retirer les siens" on follows for delete using (auth.uid() = follower);

create policy "posts visibles" on posts for select using (not hidden or auth.uid() = author_id);
create policy "posts: créer les siens" on posts for insert with check (auth.uid() = author_id);
create policy "posts: supprimer les siens" on posts for delete using (auth.uid() = author_id);

create policy "post_likes lisibles" on post_likes for select using (true);
create policy "post_likes: les siens" on post_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "signalements: créer" on reports for insert with check (auth.uid() = reporter);

-- is_premium ne doit être modifié que par le webhook Stripe (clé service), jamais par le client.
-- Suppression de compte : "on delete cascade" efface profils, likes, posts, follows (droit à l'effacement RGPD).
