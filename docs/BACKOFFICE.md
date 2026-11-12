# Backoffice Fooder (`/admin`)

Tableau de bord interne : combien d'utilisateurs, ce qu'ils font, combien de temps, funnel, rétention, parcours individuels.
Page non indexée (`robots: noindex`), non liée depuis l'appli, protégée par mot de passe.

> Choix assumé (avant la levée) : qualité des mesures d'abord. Chaque utilisateur a un identifiant stable (compte Supabase,
> anonyme par défaut). Le durcissement vie privée (purge, export RGPD, consentement plus fin) est prévu après les investisseurs.
> Le réglage « Aider à améliorer Fooder » dans Compte reste respecté (activé par défaut) : désactivé, plus rien n'est envoyé.

## 1. Migrations Supabase (SQL Editor), dans cet ordre

1. `supabase/migrations/20261111000000_accounts.sql` (si pas déjà fait)
2. `supabase/migrations/20261112000000_anonymous.sql`
3. `supabase/migrations/20261112000100_events.sql`
4. `supabase/migrations/20261113000000_tracking.sql` ← nouvelle : table `app_events` + fonctions `admin_*`

Toutes sont idempotentes : les rejouer ne casse rien. L'ancienne table `events` (pseudonyme journalier) reste en place mais n'est plus alimentée.

## 2. Réglages Supabase

- **Authentication → Sign In / Providers → Allow anonymous sign-ins : ON.** Indispensable : au premier lancement, l'appli crée
  silencieusement un compte anonyme pour rattacher les événements à un identifiant stable. Sans ça, les événements restent en
  file locale et ne partent jamais.
- Limite par défaut de Supabase : 30 créations de comptes anonymes par heure et par IP (Authentication → Rate Limits). À relever
  avant une démo en salle (beaucoup de téléphones sur le même Wi-Fi).
- Si le captcha est activé sur l'authentification, la création silencieuse échoue (pas de jeton) : les mesures attendent qu'une
  session existe (par ex. après connexion e-mail).

## 3. Variables d'environnement (Vercel → Settings → Environment Variables, Production + Preview)

| Variable | Rôle | Où la trouver |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | lit les métriques côté serveur | Supabase → Project Settings → API → clé `service_role` (ou clé `secret` `sb_secret_…`) |
| `ADMIN_PASSCODE` | mot de passe du backoffice (8 car. min., en prendre un long) | à choisir |
| `ADMIN_SESSION_SECRET` | signe le cookie de session (32 car. min.) | à générer, voir ci-dessous |

`NEXT_PUBLIC_SUPABASE_URL` (déjà présente) sert d'adresse ; `SUPABASE_URL` est accepté en secours.

Générer un secret :

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Règles :
- **Jamais** de préfixe `NEXT_PUBLIC_` sur ces trois variables (elles seraient envoyées au navigateur).
- Ne jamais les écrire dans un fichier du dépôt. En local : `.env.local` (ignoré par git).
- Redéployer après les avoir ajoutées. Changer `ADMIN_SESSION_SECRET` déconnecte toutes les sessions admin.
- Sans ces variables, `/admin` affiche une page d'explication (pas de plantage).

Sécurité en place : comparaison du mot de passe à temps constant, 8 essais / 15 min par IP, cookie `fooder_admin`
httpOnly + `secure` (en production) + `sameSite=strict`, signé HMAC-SHA256, expiration 12 h. La clé service n'est lue que dans
les routes serveur (`lib/admin/rpc.ts`), jamais renvoyée ni journalisée. Les fonctions `admin_*` ne sont exécutables que par
`service_role` (révoquées pour `anon` / `authenticated`).

## 4. Ce qui est mesuré

Table `app_events` : `user_id` (posé par la base = `auth.uid()`), `session_id`, `name`, `screen`, `rest_id`, `props` (jsonb < 2 Ko), `created_at`.
Les clients ne peuvent qu'insérer leurs propres lignes, jamais lire. Quota : 8 000 lignes / utilisateur / jour.

### Automatique (components/analytics/Tracker.tsx, monté dans components/Providers.tsx)

| Événement | Quand | Propriétés |
|---|---|---|
| `session_start` | premier événement d'une session | `device` (mobile/desktop), `standalone` (PWA installée), `ref` (site d'origine) |
| `session_end` | 30 min sans activité (daté de la dernière activité) ou fermeture de page | `duration_s`, `active_s`, `reason` |
| `screen_view` | chaque changement de route | `from` (écran précédent) ; `rest_id` sur `/resto/<id>` |
| `heartbeat` | toutes les 60 s, onglet visible et utilisateur actif depuis < 2 min | `s` = 60 |
| `click` | clic sur bouton / lien | `label` (aria-label ou texte nettoyé, 40 car.), `tag`, `target` (écran visé par un lien) |

Jamais le contenu d'un champ de saisie ou d'une zone de texte. Les e-mails et suites de 4 chiffres ou plus sont masqués dans les
libellés. Pour exclure une zone : attribut `data-no-track` ; pour imposer un libellé : `data-track-label="…"`.

Écrans : les identifiants dans l'adresse sont regroupés (`/resto/osm-n123` → `/resto/[id]`).

### Métier (appels existants à `track()`, inchangés)

`swipe` (direction), `swipe_like` / `swipe_pass` (cuisine, distance_km, **rest_id**), `open_card` (cuisine, from, **rest_id**),
`checkin`, `visit_confirmed`, `photo_posted`, `post_published`, `friend_added`, `friend_link_shared`, `friend_card_shared`,
`group_created`, `group_joined`, `group_voted`, `share`, `signup`, `auth_code_sent`, `auth_signed_in`, `defi_sent`, `defi_received`.

`track(name, props?, opts?)` accepte désormais tout nom `^[a-z0-9_]{2,40}$`. `rest_id` et `screen` peuvent être passés dans
`props` ou `opts` : ils deviennent des colonnes. Le même appel alimente aussi PostHog (si consentement donné).

### File et envoi

File locale (`localStorage`, clé `fooder_track_queue`, 500 lignes max) ; envoi par lots de 50 dès 20 lignes, sinon après 10 s,
et à la mise en arrière-plan. Hors-ligne : 5 essais puis attente du retour réseau (`online`) ou du retour au premier plan.
Session : `sessionStorage`, clé `fooder_track_session`. Les horodatages viennent du téléphone (file hors-ligne) mais la base les
ramène à l'heure serveur s'ils sortent de [−7 jours ; +5 min].

## 5. Métriques du backoffice

| Bloc | Définition |
|---|---|
| Utilisateurs | comptes `auth.users` (anonymes vs avec e-mail) |
| Nouveaux 7 j | comptes créés depuis 7 jours |
| Actifs 24 h / 7 j / 30 j | utilisateurs distincts ayant au moins un événement (DAU/WAU/MAU glissants) ; DAU/MAU = « stickiness » |
| Sessions, durée moy. / médiane | par `session_id` : dernier − premier événement |
| Temps actif moyen | battements de cœur × 60 s par session |
| Évolution quotidienne | actifs, nouveaux, sessions, likes, minutes actives par jour (heure de Paris) |
| Funnel | voir ci-dessous |
| Rétention J1/J7/J30 | cohorte = premier jour d'activité ; JN = actifs exactement N jours après ; calculé seulement sur les cohortes assez anciennes |
| Top écrans | vues (`screen_view`), personnes, temps actif |
| Top restos | likes, passes, ouvertures (fiche + page partagée), taux de like ; noms lus dans `data/toulouse-places.json` |
| Activité produit | likes, passes, fiches, check-ins, posts (table `posts`), invitations (`share`, liens, défis), groupes, amitiés, comptes sauvegardés |
| Parcours d'un utilisateur | timeline des 300 derniers événements (sans battements), groupés par session |

### Lire le funnel

- Chaque étape compte les **utilisateurs distincts** qui l'ont faite **après** l'étape précédente (ordre strict, sans limite de
  temps). Le point de départ (étape 1) est dans la période choisie.
- Le chiffre entre deux étapes = conversion depuis l'étape précédente ; à droite = part de l'étape 1 encore présente.
  Vert ≥ 50 %, jaune ≥ 20 %, rose en dessous. « délai médian » = temps typique pour passer d'une étape à l'autre.
- Funnel par défaut : `session_start → swipe → swipe_like → open_card → checkin`. Champ libre : 2 à 8 noms séparés par des
  virgules ; une étape peut viser un écran : `screen_view:/groupe`.

## 6. Requêtes de vérification (SQL Editor)

```sql
-- La table et les fonctions existent
select to_regclass('public.app_events') as table_ok;
select proname from pg_proc where proname like 'admin\_%' order by 1;

-- Les clients ne peuvent ni lire ni exécuter les fonctions admin (attendu : false partout)
select has_table_privilege('authenticated', 'public.app_events', 'select') as client_peut_lire,
       has_function_privilege('anon', 'public.admin_overview(int)', 'execute') as anon_admin,
       has_function_privilege('authenticated', 'public.admin_overview(int)', 'execute') as auth_admin,
       has_function_privilege('service_role', 'public.admin_overview(int)', 'execute') as service_ok; -- true

-- Derniers événements reçus
select created_at, user_id, session_id, name, screen, rest_id, props
from public.app_events order by id desc limit 50;

-- Événements par nom, 7 derniers jours
select name, count(*), count(distinct user_id) from public.app_events
where created_at > now() - interval '7 days' group by 1 order by 2 desc;

-- Les fonctions du tableau de bord (exécutées en rôle postgres dans l'éditeur)
select public.admin_overview(30);
select * from public.admin_daily(7);
select * from public.admin_funnel(array['session_start','swipe','swipe_like','open_card','checkin'], 30);
select * from public.admin_retention(30, 'day');
select * from public.admin_top_screens(30, 10);
select * from public.admin_top_restos(30, 10);
select * from public.admin_recent_users(10);
-- select * from public.admin_user_timeline('<uuid>', 50);

-- Insertion test « comme un client » (doit réussir) puis lecture (doit renvoyer 0 ligne / erreur de droit)
-- begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid d''un utilisateur>"}';
-- insert into public.app_events (session_id, name, screen) values ('test_session', 'debug_ping', '/swipe');
-- select count(*) from public.app_events; -- erreur : permission refusée
-- rollback;
```

## 7. Fichiers

- `lib/tracking.ts` : logique pure (sessions, file, lots, validation) — tests `tests/tracking.test.ts`
- `lib/analytics.ts` : câblage navigateur (`track`, `getTracker`, réglage d'usage, PostHog)
- `components/analytics/Tracker.tsx` : écrans, clics, battements de cœur, session anonyme silencieuse
- `lib/admin/auth.ts` (mot de passe, cookie signé, limiteur) — tests `tests/adminAuth.test.ts`
- `lib/admin/metrics.ts` (taux, funnel, cohortes, durées) — tests `tests/adminMetrics.test.ts`
- `lib/admin/rpc.ts` (appel des fonctions SQL avec la clé service), `lib/admin/types.ts`
- `app/admin/page.tsx`, `components/admin/*`, `app/api/admin/{login,logout,metrics}/route.ts`
