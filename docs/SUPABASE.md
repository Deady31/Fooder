# Brancher les comptes Supabase

Sans ces réglages, l'appli reste en mode local (tout marche, rien n'est sauvegardé en ligne).

## 1. Créer le projet (5 min)

1. Créer un compte sur supabase.com, puis **New project**.
2. Région : **West EU (Paris)** ou **Central EU (Frankfurt)** (RGPD).
3. Noter le mot de passe de la base dans un gestionnaire de mots de passe (il ne sert pas à l'appli).

## 2. Créer les tables et la sécurité

**SQL Editor → New query**, coller tout le fichier `supabase/migrations/20261111000000_accounts.sql`, puis **Run**.
Le script crée : profils, état synchronisé, amis, sessions de groupe (+ temps réel), posts, signalements, le bucket de photos et toutes les règles d'accès (RLS).

## 3. Authentification par code e-mail

**Authentication → Sign In / Providers → Email** : activé, « Confirm email » activé.

**Authentication → Emails → Magic Link** : remplacer le contenu par un modèle qui affiche le code, par exemple :

```html
<h2>Ton code Fooder</h2>
<p>Entre ce code dans l'appli : <strong style="font-size:28px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>Ou touche ce lien : <a href="{{ .ConfirmationURL }}">me connecter</a></p>
<p>Il expire dans 1 heure. Si tu n'as rien demandé, ignore cet e-mail.</p>
```

Faire de même pour **Confirm signup** (premier envoi à une nouvelle adresse).

**Authentication → URL Configuration** :
- Site URL : `https://fooder-tawny.vercel.app`
- Redirect URLs : `https://fooder-tawny.vercel.app/compte` et `http://localhost:3000/compte`

L'envoi d'e-mails intégré de Supabase est limité à quelques messages par heure : suffisant pour tester. Avant le lancement, brancher un SMTP (Resend, Brevo…) dans **Authentication → Emails → SMTP Settings**.

## 4. Clés dans l'appli

**Project Settings → API** : copier `Project URL` et la clé `anon` / `publishable` (publique par conception : la sécurité repose sur les règles RLS).
Ne jamais utiliser la clé `service_role` / `secret` dans l'appli.

- En local : fichier `.env.local` à la racine

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- Sur Vercel : **Settings → Environment Variables**, mêmes deux variables (Production + Preview), puis redéployer.

## Ce que fait le compte

| Donnée | Où | Qui la voit |
|---|---|---|
| Likes, visites, XP, trophées, préférences | `user_state` (fusion à la connexion, puis sauvegarde auto toutes les 20 s) | Toi seul |
| Pseudo, mascotte, carte d'ami | `profiles` | Toi et tes amis |
| Amitiés | `friendships` (réciproque via code d'ami) | Toi |
| Sessions « On mange où ? » | `groups`, `group_members`, `group_votes` (temps réel) | Membres de la session |
| Posts et vraies photos | `posts` + bucket `photos` | Tout le monde |

Suppression de compte : Profil → Compte → « Supprimer mon compte » (photos supprimées, puis compte ; le reste suit en cascade).
