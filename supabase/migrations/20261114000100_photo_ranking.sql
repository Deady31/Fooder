-- Fooder · classement des photos : cœurs sur les posts (la photo la plus aimée devient celle de la carte).
-- Idempotente : peut être rejouée sans erreur. Ne modifie aucune migration existante.

-- ═════════════════════════ Cœurs de posts ═════════════════════════
create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

alter table public.post_likes enable row level security;

-- Chacun ne voit, ajoute et retire que ses propres cœurs. Les totaux passent par la vue ci-dessous.
drop policy if exists "cœurs: les siens (lecture)" on public.post_likes;
create policy "cœurs: les siens (lecture)" on public.post_likes for select using (user_id = auth.uid());
drop policy if exists "cœurs: ajouter" on public.post_likes;
create policy "cœurs: ajouter" on public.post_likes for insert
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
drop policy if exists "cœurs: retirer" on public.post_likes;
create policy "cœurs: retirer" on public.post_likes for delete using (user_id = auth.uid());

revoke all on public.post_likes from anon;
revoke update on public.post_likes from authenticated;
grant select, insert, delete on public.post_likes to authenticated;

-- ═════════════════════════ Totaux publics ═════════════════════════
-- Nombre de cœurs par post visible (aucune identité exposée).
create or replace view public.post_like_counts with (security_invoker = false) as
  select l.post_id, count(*)::int as likes
  from public.post_likes l
  join public.posts p on p.id = l.post_id and not p.hidden
  group by l.post_id;

revoke all on public.post_like_counts from anon, authenticated;
grant select on public.post_like_counts to anon, authenticated;
