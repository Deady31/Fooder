-- Fooder · comptes anonymes (connexion sans friction) : quotas resserrés et nettoyage.
-- À exécuter APRÈS 20261111000000_accounts.sql. Idempotent.
--
-- Un utilisateur anonyme (signInAnonymously) a le rôle Postgres « authenticated » et le claim JWT
-- is_anonymous = true. Toutes les politiques RLS existantes s'appliquent donc telles quelles :
-- profil (créé par le trigger handle_new_user), état synchronisé, amis, groupes, posts, photos, signalements.
-- Les compte anonymes sont plus faciles à fabriquer en masse : on resserre donc les quotas d'abus pour eux,
-- et on supprime ceux qui sont abandonnés. Convertis en compte e-mail (updateUser), ils retrouvent les quotas normaux
-- avec le même identifiant, donc sans perte de données.
--
-- ATTENTION : ce fichier remplace add_friend, guard_post, guard_report et la politique « photos: déposer dans son dossier »
-- de 20261111000000_accounts.sql. Si accounts.sql est rejoué un jour, rejouer ce fichier juste après.

-- Vrai si l'appelant est un utilisateur anonyme (claim absent => compte normal)
create or replace function public.is_anon()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;
revoke execute on function public.is_anon() from public, anon;
grant execute on function public.is_anon() to authenticated;

-- ═════════════════════════ Compteurs de quotas ═════════════════════════
-- Un compteur par utilisateur, type d'action et jour (heure de Paris). Supprimer un post ou un groupe ne rend pas de crédit :
-- compter les lignes existantes permettait de contourner le plafond en supprimant puis republiant. Jamais lisible par les clients.
create table if not exists public.action_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null check (kind in ('post', 'report', 'group')),
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, kind, day)
);
alter table public.action_quota enable row level security;
revoke all on public.action_quota from anon, authenticated;

-- Consomme une unité de quota ; renvoie false si le plafond est dépassé. L'appelant lève alors une exception,
-- ce qui annule aussi l'incrément (même transaction). Les compteurs des jours passés de l'utilisateur sont effacés au passage.
create or replace function public.take_quota(who uuid, what text, cap int)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  used int;
begin
  delete from public.action_quota q where q.user_id = who and q.day < today;
  insert into public.action_quota as q (user_id, kind, day, n) values (who, what, today, 1)
    on conflict (user_id, kind, day) do update set n = q.n + 1
    returning q.n into used;
  return used <= cap;
end $$;
revoke execute on function public.take_quota(uuid, text, int) from public, anon, authenticated;

-- ═════════════════════════ Amis : 500 pour un compte, 30 pour un anonyme ═════════════════════════
-- La personne ajoutée a aussi un plafond (500) : sinon des comptes jetables pourraient saturer sa liste avec son code d'ami.
-- Ré-ajouter un ami existant ne consomme rien (utile après connexion à un compte existant, cf. reattachLocalFriends).
create or replace function public.add_friend(code text)
returns table (id uuid, name text, avatar_id text, avatar_bg text, card jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target uuid;
  cap int := case when public.is_anon() then 30 else 500 end;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select p.id into target from profiles p where p.friend_code = code;
  if target is null then raise exception 'unknown friend code'; end if;
  if target = auth.uid() then raise exception 'cannot add yourself'; end if;
  if not exists (select 1 from friendships f where f.user_id = auth.uid() and f.friend_id = target) then
    if (select count(*) from friendships f where f.user_id = auth.uid()) >= cap then raise exception 'too many friends'; end if;
    if (select count(*) from friendships f where f.user_id = target) >= 500 then raise exception 'friend list full'; end if;
    insert into friendships (user_id, friend_id) values (auth.uid(), target), (target, auth.uid()) on conflict do nothing;
  end if;
  return query select p.id, p.name, p.avatar_id, p.avatar_bg, p.card from profiles p where p.id = target;
end $$;

-- ═════════════════════════ Posts : 30 par jour, 5 pour un anonyme ═════════════════════════
create or replace function public.guard_post()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  new.hidden := false;
  if not public.take_quota(new.user_id, 'post', case when public.is_anon() then 5 else 30 end) then
    raise exception 'daily post limit reached';
  end if;
  return new;
end $$;

-- ═════════════════════════ Signalements : 20 par jour, 5 pour un anonyme ═════════════════════════
create or replace function public.guard_report()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  if not public.take_quota(new.reporter, 'report', case when public.is_anon() then 5 else 20 end) then
    raise exception 'daily report limit reached';
  end if;
  return new;
end $$;

-- ═════════════════════════ Sessions de groupe : 20 créées par jour, 5 pour un anonyme ═════════════════════════
-- created_at est posé par le serveur (un created_at ancien fourni par le client échappait au comptage).
create or replace function public.guard_group()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.created_at := now();
  -- Groupe déjà publié : l'hôte re-synchronise avec un upsert « ignore duplicates », rien n'est créé, pas de quota consommé
  if exists (select 1 from groups g where g.id = new.id) then return new; end if;
  if not public.take_quota(new.host, 'group', case when public.is_anon() then 5 else 20 end) then
    raise exception 'daily group limit reached';
  end if;
  return new;
end $$;
drop trigger if exists guard_group on public.groups;
create trigger guard_group before insert on public.groups for each row execute function public.guard_group();

-- ═════════════════════════ État synchronisé : date de sauvegarde posée par le serveur ═════════════════════════
-- updated_at sert au nettoyage des comptes anonymes abandonnés : il ne doit pas être choisi par le client.
create or replace function public.touch_user_state()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists touch_user_state on public.user_state;
create trigger touch_user_state before insert or update on public.user_state for each row execute function public.touch_user_state();

revoke execute on function public.guard_post(), public.guard_report(), public.guard_group(), public.touch_user_state()
  from public, anon, authenticated;
revoke execute on function public.add_friend(text) from public, anon;
grant execute on function public.add_friend(text) to authenticated;

-- ═════════════════════════ Photos : nom imposé et plafond quotidien d'envois ═════════════════════════
-- Sans plafond, un compte (anonyme, donc jetable) pouvait déposer un nombre illimité de fichiers dans le bucket public
-- sans jamais publier de post. Plafond = même valeur que les posts (30 par 24 h, 5 pour un anonyme).
-- Fonction « invoker » : le comptage passe par la politique de lecture « photos: lister les siennes ».
create or replace function public.photo_upload_allowed()
returns boolean language plpgsql stable set search_path = public, pg_temp as $$
begin
  return (
    select count(*) from storage.objects o
    where o.bucket_id = 'photos'
      and o.name like auth.uid()::text || '/%'
      and o.created_at > now() - interval '1 day'
  ) < case when public.is_anon() then 5 else 30 end;
end $$;
revoke execute on function public.photo_upload_allowed() from public, anon;
grant execute on function public.photo_upload_allowed() to authenticated;

drop policy if exists "photos: déposer dans son dossier" on storage.objects;
create policy "photos: déposer dans son dossier" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|webp)$')
    and public.photo_upload_allowed()
  );

-- ═════════════════════════ Nettoyage des comptes anonymes abandonnés ═════════════════════════
-- Supprime les comptes anonymes sans aucune sauvegarde depuis N jours (30 par défaut, minimum 7). Cascade : profil, état, amitiés, posts, votes.
-- Les photos du bucket ne sont pas supprimées par la cascade SQL (Supabase interdit de supprimer des fichiers en SQL) :
-- voir docs/SUPABASE.md § 3.5 pour les retirer via l'API Storage.
-- Réservée au rôle serveur : à planifier avec pg_cron (Database > Extensions > pg_cron), par exemple :
--   select cron.schedule('purge-anonymous', '17 3 * * *', $$ select public.purge_stale_anonymous(30) $$);
create or replace function public.purge_stale_anonymous(days int default 30)
returns int language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare n int;
begin
  with gone as (
    delete from auth.users u
    where u.is_anonymous = true
      and u.created_at < now() - make_interval(days => greatest(days, 7))
      -- « activité » = dernière sauvegarde de l'état (last_sign_in_at ne bouge pas quand le jeton se renouvelle)
      and coalesce((select max(s.updated_at) from public.user_state s where s.user_id = u.id), u.created_at)
          < now() - make_interval(days => greatest(days, 7))
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;
revoke execute on function public.purge_stale_anonymous(int) from public, anon, authenticated;
