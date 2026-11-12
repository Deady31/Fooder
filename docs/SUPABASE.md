# Brancher les comptes Supabase

Sans ces réglages, l'appli reste en mode local (tout marche, rien n'est sauvegardé en ligne, aucune mesure envoyée).

## 1. Créer le projet (5 min)

1. Créer un compte sur supabase.com, puis **New project**.
2. Région : **West EU (Paris)** ou **Central EU (Frankfurt)** (RGPD).
3. Noter le mot de passe de la base dans un gestionnaire de mots de passe (il ne sert pas à l'appli).

## 2. Créer les tables et la sécurité

**SQL Editor → New query**, coller puis **Run**, **dans cet ordre**, un fichier à la fois :

1. `supabase/migrations/20261111000000_accounts.sql` : profils, état synchronisé, amis, sessions de groupe (+ temps réel), posts, signalements, bucket de photos et règles d'accès (RLS).
2. `supabase/migrations/20261112000000_anonymous.sql` : comptes anonymes (quotas d'abus resserrés pour eux : 30 amis, 5 posts/jour, 5 groupes/jour, 5 signalements/jour, 5 envois de photo par 24 h ; 30/20/20/30 pour un compte e-mail), compteurs de quota `action_quota` (supprimer puis republier ne rend pas de crédit), plafond de 500 amis aussi côté personne ajoutée, date de sauvegarde `user_state.updated_at` posée par le serveur, et fonction de nettoyage `purge_stale_anonymous`.
3. `supabase/migrations/20261112000100_events.sql` : table `events` (mesures d'usage), liste blanche des propriétés appliquée par le serveur, quota, sel quotidien du pseudonyme, vue `events_daily`, fonction de purge `purge_old_events`.

Tous les scripts sont rejouables sans dégât. Le fichier 2 remplace des fonctions et la politique d'envoi de photos du fichier 1 : si le fichier 1 est rejoué un jour, rejouer aussi le 2 (puis le 3) juste après.

## 3. Connexion : anonyme d'abord, e-mail ensuite

### 3.1 Autoriser les connexions anonymes (obligatoire)

**Authentication → Sign In / Providers → « Allow anonymous sign-ins »** : activer.

L'appli ne demande aucune inscription. Au premier besoin en ligne (ajout d'ami par code, session de groupe, photo publiée), elle appelle `ensureSession()` (fournie par `useAuth()`), qui crée un compte anonyme invisible. Il a le rôle `authenticated` avec le claim `is_anonymous = true` : toutes les règles RLS s'appliquent comme pour un compte normal.

Si ce réglage est désactivé, `ensureSession()` renvoie `{ ok: false, reason: 'anon_disabled' }` avec un message clair, ne réessaie pas pendant la visite, et l'appli reste en mode local.

Dans le code, l'appelant doit faire (exemple) :

```ts
const { ensureSession } = useAuth();
const res = await ensureSession();
if (!res.ok) { toast(res.message); return; } // repli local
// res.uid est disponible, on peut appeler addFriendByCode / syncGroup / publishCloudPost
```

### 3.2 Anti-abus : captcha (obligatoire avant le lancement public)

Un compte anonyme se crée sans e-mail : n'importe quel script peut en fabriquer. Les quotas SQL sont **par compte** : ils ne protègent pas contre la création de comptes en masse. Sans captcha, une seule adresse IP peut créer environ 720 comptes par jour (limite par défaut de 30/heure), chacun pouvant stocker jusqu'à 900 Ko d'état synchronisé, 5 photos et 300 mesures par jour : la base gratuite (500 Mo) peut être saturée en moins d'une journée, et le fil public inondé.
**Authentication → Settings (Bot and Abuse Protection) → Enable Captcha protection** (Cloudflare Turnstile, mode invisible, ou hCaptcha), puis renseigner la clé secrète.
Le captcha s'applique aussi à `signInWithOtp`. Une fois activé, il faut fournir un jeton côté client : `useAuth().ensureSession({ captchaToken })` et `useAuth().sendCode(email, captchaToken)` le transmettent à Supabase (le widget Turnstile/hCaptcha reste à brancher dans l'appli). Tant que ce n'est pas fait, laisser le captcha désactivé, sinon les connexions échouent.
Dans **Authentication → Rate Limits**, baisser « Anonymous users » (30 par heure et par IP par défaut ; 10 suffit pour un usage normal). Activer aussi les alertes de taille de base (**Reports / Usage**).

### 3.3 Sauvegarder le compte (anonyme → e-mail)

Dans **Compte**, « Sauvegarde ton compte » rattache un e-mail au compte anonyme (`updateUser({ email })`) puis le valide par code (`verifyOtp` de type `email_change`). L'identifiant reste le même : amis, groupes, posts et progression sont conservés.

- Si l'adresse a déjà un compte, l'appli propose de s'y **connecter** : les données de ce téléphone sont fusionnées avec celles du compte (`lib/cloud/merge.ts`, rien n'est effacé) et les amitiés de l'appareil sont recréées sur le compte. Les posts publiés avec l'ancien compte anonyme restent attachés à lui.
- Un compte anonyme déconnecté ne peut pas être retrouvé : l'appli n'affiche donc pas « Se déconnecter » tant que le compte n'est pas sauvegardé.
- Réponse « adresse déjà utilisée » : Supabase la renvoie à tout compte anonyme qui appelle `updateUser({ email })`. Quelqu'un peut donc tester si une adresse a un compte Fooder (limite propre à Supabase, non corrigeable côté appli).
- Pré-détournement : un compte anonyme peut demander à rattacher l'adresse d'une autre personne. Celle-ci reçoit alors un e-mail « Change Email Address » ; si elle touche le lien, son adresse est rattachée au compte de l'auteur de la demande, qui garde sa session. D'où un gabarit distinct et explicite pour cet e-mail (§ 3.4) : ne jamais l'intituler « me connecter ».

### 3.4 E-mail avec code à 6 chiffres (en plus du lien)

Le code permet de se connecter dans la PWA installée (iOS ouvre les liens dans Safari, pas dans l'appli).

**Authentication → Sign In / Providers → Email** : activé, « Confirm email » activé.

**Authentication → Emails → Templates** : coller ce gabarit dans **Magic Link** et **Confirm signup** :

```html
<h2>Ton code Fooder</h2>
<p>Entre ce code dans l'appli : <strong style="font-size:28px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>Ou touche ce lien : <a href="{{ .ConfirmationURL }}">me connecter</a></p>
<p>Il expire dans 10 minutes. Si tu n'as rien demandé, ignore cet e-mail.</p>
```

Et ce gabarit **différent** dans **Change Email Address** (sauvegarde d'un compte anonyme ; voir « pré-détournement » au § 3.3) :

```html
<h2>Rattacher cette adresse à un compte Fooder</h2>
<p>Quelqu'un veut sauvegarder un compte Fooder avec cette adresse. Si c'est toi, entre ce code dans l'appli :
<strong style="font-size:28px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>Ou touche ce lien : <a href="{{ .ConfirmationURL }}">oui, rattacher mon adresse</a></p>
<p><strong>Si tu n'as rien demandé, ne touche pas le lien et ne transmets pas le code</strong> : ton adresse serait rattachée au compte de quelqu'un d'autre.
Il expire dans 10 minutes.</p>
```

Longueur du code : **Authentication → Sign In / Providers → Email → Email OTP Length** = 6 (valeur par défaut). L'appli accepte 6 à 8 chiffres. Supabase limite le renvoi à un e-mail par minute : l'appli affiche un compte à rebours de 60 s.
Durée de validité : **Email OTP Expiration** = **600** secondes (3600 par défaut). Supabase ne limite les essais de code que par adresse IP (30 par 5 min) et non par code : une validité courte réduit fortement les chances d'un essai massif depuis de nombreuses IP. La limite de 5 erreurs affichée par l'appli n'est qu'un confort d'interface.

**Authentication → URL Configuration** :
- Site URL : `https://fooder-tawny.vercel.app`
- Redirect URLs : `https://fooder-tawny.vercel.app/compte` (adresses exactes, jamais de joker `**`). `http://localhost:3000/compte` seulement sur un projet Supabase de développement, pas sur celui de production.

L'envoi d'e-mails intégré de Supabase est limité à quelques messages par heure : suffisant pour tester. Avant le lancement, brancher un SMTP (Resend, Brevo…) dans **Authentication → Emails → SMTP Settings**.

### 3.5 Nettoyage planifié (obligatoire : la politique de confidentialité annonce ces durées)

Dans **Database → Extensions**, activer `pg_cron`, puis dans le SQL Editor :

```sql
select cron.schedule('purge-anonymous', '17 3 * * *', $$ select public.purge_stale_anonymous(30) $$);
select cron.schedule('purge-events',    '31 3 * * *', $$ select public.purge_old_events() $$);
```

- `purge_stale_anonymous(30)` supprime les comptes anonymes sans aucune sauvegarde depuis 30 jours (cascade : profil, état, amitiés, posts, votes). **Les fichiers photo restent dans le bucket public** (Supabase interdit de les supprimer en SQL) : leurs adresses restent valables. À traiter avant le lancement : tâche serveur (Edge Function planifiée, clé `service_role` côté serveur uniquement) qui supprime via l'API Storage les dossiers `photos/<id>/` dont l'id n'existe plus dans `auth.users`.
- `purge_old_events()` supprime les mesures de plus de 13 mois, et les sels et compteurs des jours passés. Elle est aussi appelée automatiquement à la première mesure de chaque jour ; la tâche planifiée couvre les jours sans aucune mesure (le sel de la veille ne doit pas survivre).

## 4. Clés dans l'appli

**Project Settings → API** : copier `Project URL` et la clé `anon` / `publishable` (publique par conception : la sécurité repose sur les règles RLS).
Ne jamais utiliser la clé `service_role` / `secret` dans l'appli.

- En local : fichier `.env.local` à la racine

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- Sur Vercel : **Settings → Environment Variables**, mêmes deux variables (Production + Preview), puis redéployer.

## 5. Mesures d'usage anonymes

Fonction : `track(name, props?)` de `lib/analytics.ts` (la même que celle déjà utilisée pour PostHog : un appel alimente les deux, chacun avec ses propres règles de consentement).

Les mesures vont dans la table `events` seulement si : le cloud est configuré, le réglage « Aider à améliorer Fooder » est actif (par défaut oui, modifiable dans Compte) et une session existe (anonyme ou non). Sans session, la file (200 lignes max, dans `localStorage`, clé `fooder_usage_queue`) attend. Envoi groupé : toutes les 15 s, dès 20 événements en file, ou quand l'appli passe en arrière-plan.

> Une personne qui n'a jamais utilisé de fonction en ligne n'a pas de session : ses mesures ne partent pas. Pour compter aussi ces personnes, il faudrait appeler `ensureSession()` à l'ouverture de l'appli (non fait volontairement : cela créerait un compte pour tout le monde).

### Liste blanche des événements et propriétés

Un événement hors liste est ignoré. Une propriété hors schéma, ou de forme non sûre, est supprimée. Mot-clé = minuscules, chiffres, `_` et `-`, 24 caractères max (aucun texte libre ni nom de restaurant). Nombre = entier arrondi.

| Événement | Quand | Propriétés (toutes facultatives) |
|---|---|---|
| `swipe_like` | like d'un restaurant | `cuisine` (mot-clé), `position` (nombre, rang dans le paquet), `distance_km` (nombre) |
| `swipe_pass` | passe d'un restaurant | `cuisine`, `position`, `distance_km` |
| `open_card` | ouverture de la fiche détaillée | `cuisine`, `from` (mot-clé : `swipe`, `map`, `feed`…) |
| `checkin` | réponse « Tu y es allé ? » | `verdict` (`miam`, `bof`, `atester`), `photo` (booléen) |
| `friend_added` | ami ajouté | `method` (`code`, `link`, `qr`) |
| `group_joined` | session de groupe rejointe ou créée | `size` (nombre de participants), `role` (`host`, `guest`) |
| `photo_posted` | photo publiée | `verdict` |
| `signup` | compte sauvegardé ou créé (envoyé par l'appli) | `method` (`upgrade`, `otp`) |
| `share` | partage | `kind` (`card`, `friend`, `group`, `defi`) |

Le schéma est à **trois** endroits, à garder identiques : `PROP_SCHEMA` (`lib/usage.ts`), le `check (name in (...))` de la table `events` et la liste de `clean_event_props` (migration `events`, nouvelle migration pour toute modification une fois en production). Le serveur retire toute propriété absente de sa liste, même si le client l'envoie.

### Ce qui est enregistré côté serveur

`events(id, created_at, actor, name, props)`.
- `created_at` : posé par le serveur.
- `actor` : empreinte (SHA-256 tronquée) de l'identifiant du compte et d'un **sel aléatoire du jour** (table `events_salt`, illisible par les clients, supprimée dès le lendemain). Elle permet de compter les actifs du jour. Une fois le sel détruit, personne, propriétaire compris, ne peut recalculer l'empreinte ni relier deux jours. Aucun e-mail, aucun identifiant de compte.
- `events_quota` (identifiant du compte + nombre de mesures du jour) : sert au quota, seule la journée en cours est conservée.
- Les clients ne peuvent qu'insérer (pas de select/update/delete). Quota : 300 événements par utilisateur et par jour (au-delà, ignorés en silence). `props` : objet JSON de 400 octets max, refiltré par le serveur.

### Interroger les chiffres (SQL Editor)

```sql
-- Par jour et par événement
select * from events_daily limit 100;

-- Likes vs passes sur 7 jours, par cuisine
select props->>'cuisine' as cuisine, name, count(*)
from events
where name in ('swipe_like','swipe_pass') and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;

-- Utilisateurs actifs par jour (tous événements)
select (created_at at time zone 'Europe/Paris')::date as jour, count(distinct actor) as actifs
from events group by 1 order by 1 desc;
```

## Ce que fait le compte

| Donnée | Où | Qui la voit |
|---|---|---|
| Likes, visites, XP, trophées, préférences | `user_state` (fusion à la connexion, puis sauvegarde auto toutes les 20 s) | Toi seul |
| Pseudo, mascotte, carte d'ami | `profiles` | Toi et tes amis |
| Amitiés | `friendships` (réciproque via code d'ami) | Toi |
| Sessions « On mange où ? » | `groups`, `group_members`, `group_votes` (temps réel) | Membres de la session |
| Posts et vraies photos | `posts` + bucket `photos` | Tout le monde |
| Mesures d'usage | `events` (pseudonyme du jour à sel détruit, 13 mois) | Propriétaire seulement (SQL Editor) |

Suppression de compte : Profil → Compte → « Supprimer mon compte » (photos supprimées, puis compte ; le reste suit en cascade, y compris pour un compte anonyme).
