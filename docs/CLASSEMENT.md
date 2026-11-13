# Classement « Score communauté »

Récompense les plus belles photos de plats. Page : `/classement` (onglets Global et Amis).

## Score (calculé par le serveur)

- 10 points par photo publiée (post avec `photo_path`, non masqué)
- 3 points par cœur reçu sur ses photos ; ses propres cœurs ne comptent pas
- Un seul cœur par personne et par post (clé primaire `post_id, user_id`)
- Périodes : `week` (depuis lundi 00:00, heure de Paris) et `all`
- Aucune donnée du client (XP, etc.) n'entre dans le calcul. Sans photo, pas de ligne au classement.

L'onglet Amis est local : il classe toi et tes amis par photos puis XP, à partir des cartes d'amis (rien n'est envoyé).

## Migration

Fichier : `supabase/migrations/20261114000000_leaderboard.sql` (à jouer après `20261113000000_tracking.sql`).
Supabase > SQL Editor > coller le fichier > Run. Idempotent : on peut le rejouer sans risque.

Elle crée :
- `post_likes` (n'existait pas côté serveur : les cœurs du fil étaient locaux) avec RLS : on lit/retire seulement les siens, on ne peut pas aimer son propre post ni un post masqué ;
- `leaderboard(period text, lim int default 50)` : top N (max 100) avec `rank, user_id, pseudo, avatar_id, avatar_bg, photos, hearts, score` ;
- `my_rank(period text)` : `rank, score, photos, hearts, total` de l'appelant (aucune ligne = pas classé) ;
- fonctions internes `leaderboard_rows` et `leaderboard_since` (non appelables par les clients).

`leaderboard` et `my_rank` : `SECURITY DEFINER`, `search_path` figé, EXECUTE réservé au rôle `authenticated` (comptes anonymes inclus), retiré à `anon` et `public`. Seuls pseudo et mascotte sortent.

## Vérifications (SQL Editor)

```sql
-- Les fonctions existent et les droits sont bons (anon/public absents)
select p.proname, p.prosecdef, p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('leaderboard', 'my_rank', 'leaderboard_rows', 'leaderboard_since');

-- Début de la semaine en cours (doit être un lundi 00:00 heure de Paris)
select public.leaderboard_since('week') at time zone 'Europe/Paris' as lundi_paris;

-- Contrôle croisé du score, sans passer par les fonctions (remplacer l'uuid)
select
  (select count(*) from public.posts where user_id = :'uid' and photo_path is not null and not hidden) as photos,
  (select count(*) from public.post_likes l join public.posts p on p.id = l.post_id
    where p.user_id = :'uid' and p.photo_path is not null and not p.hidden and l.user_id <> p.user_id) as coeurs;

-- Aucun cœur sur son propre post (doit renvoyer 0 ligne)
select l.* from public.post_likes l join public.posts p on p.id = l.post_id where l.user_id = p.user_id;
```

Depuis un client connecté (console du navigateur, ou RPC avec un jeton utilisateur) :

```sql
select * from public.leaderboard('week', 10);   -- via SQL Editor : auth.uid() est null, la fonction refuse
select * from public.my_rank('all');
```
Dans le SQL Editor `auth.uid()` est nul : pour tester, simuler un utilisateur avec
`select set_config('request.jwt.claim.sub', '<uuid>', true); set local role authenticated;` avant l'appel.

## À savoir

- Le fil de l'appli est encore en démo/local : tant que les posts avec photo et les cœurs ne sont pas écrits dans `posts` / `post_likes` (publication cloud, bouton cœur), le classement reste vide. La publication cloud des posts existe (`publishCloudPost`) ; l'écriture des cœurs reste à brancher côté client.
- Les comptes anonymes sont faciles à fabriquer : un groupe de faux comptes pourrait s'offrir des cœurs. Piste si besoin : ne compter que les cœurs des comptes non anonymes ou limiter les cœurs par jour.
