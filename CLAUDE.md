# FOODER : contexte pour toute session Claude (PC ou cloud)

PWA mobile-first de swipe de restaurants à Toulouse (Grand Toulouse). Next.js 14 App Router, TypeScript, Tailwind, Framer Motion, vitest, Supabase (comptes anonymes, RLS), Vercel (déploiement automatique de `main`). Dépôt public : https://github.com/Deady31/Fooder. Site : https://fooder-tawny.vercel.app.
Direction artistique : « Bubbly Maximalism » (crème/prune, ombres dures, stickers plats 2D). Textes de l'interface en français, tutoiement.

## Façon de travailler avec le fondateur (Riyan)
- Réponses COURTES, en français, l'action d'abord. Preuve > promesse : lancer, vérifier, montrer. Ne jamais dire « ça devrait marcher ».
- Il veut le produit le plus abouti possible (UX, dopamine, animations, finition). La sécurité poussée et la monétisation sont REPORTÉES après la démo investisseurs (garde l'essentiel : jamais de clé dans le code, jamais de données personnelles en clair).
- AUCUNE fausse donnée dans l'interface ni dans le backoffice (`/admin`). Les exemples sont étiquetés « exemple » et disparaissent dès qu'il y a de vraies données.
- Ne jamais afficher, journaliser ni committer une clé (Supabase secret, Google Places, ADMIN_*). Elles vivent dans Vercel (Production) et `.env.local` (ignoré par git).

## Commandes
- Dev : `npm run dev` (port 3000). Tests : `npx vitest run`. Types : `npx tsc --noEmit` (ignorer les erreurs sous `.next/types`).
- NE PAS lancer `next build` dans le dossier de travail pendant qu'un serveur de dev tourne : ça corrompt `.next`. Pour vérifier un build : exporter l'index (`git checkout-index -a --prefix=<dossier-temp>/`), relier `node_modules`, construire dans cette copie.
- Tester l'appli SANS polluer la base de production : `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run dev -- -p 3100` (cloud désactivé, 100 % local). Ne jamais créer de comptes ni d'événements sur la base réelle pour tester.
- Windows : l'export d'index convertit les fins de ligne en CRLF ; pas de ligne shebang `#!` dans les scripts importés par vitest.

## Git
- Commits petits et explicites : `git add <fichiers>` un par un, JAMAIS `git add -A` (des travaux en cours d'autres sessions peuvent traîner dans le dossier). Vérifier `tsc` + tests + build sur l'état exporté de l'index avant de pousser. Pousser = déployer en production (Vercel).
- Pied de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- DEUX SESSIONS POSSIBLES (PC à la maison, cloud sur téléphone) : toujours `git pull --rebase` au début, commit + push à la fin ; ne pas travailler dans les deux sur les mêmes fichiers en même temps. Si besoin, une branche par sujet.

## Données et photos (règles produit)
- La carte à swipe doit montrer UN PLAT. Priorité d'affichage : plat envoyé par le restaurant > photo d'un utilisateur (la plus aimée) > photo du site du restaurant > plat typique libre de droit (Wikimedia, crédité) > illustration. Google n'est jamais sur la carte et JAMAIS stocké (conditions de Google) : seulement à l'ouverture de la fiche (`/api/place-photos`, plafonné par `GOOGLE_PHOTOS_DAILY_CAP`).
- Le fondateur a obtenu l'accord oral des restaurateurs du Grand Toulouse pour afficher leurs photos (`data/photo-consent.json`, section `blanket`). Retrait : `node scripts/block-photo.mjs <id> --revoke`. Mauvaise photo : `node scripts/block-photo.mjs <id> "raison"`. Photos servies : `public/restos/<id>.webp`. Originaux : sur le PC du fondateur uniquement (non versionnés).
- Données restaurants : `data/toulouse-places.json` (OSM). Régimes : champ `dt`/`diets`. Horaires : `lib/openingHours.ts` (heure de Paris). Les restaurants fermés ne sont pas affichés.

## Supabase (migrations à jouer dans le SQL Editor, dans l'ordre)
20261111000000_accounts, 20261112000000_anonymous, 20261112000100_events, 20261113000000_tracking, 20261114000100_photo_ranking, 20261114000000_leaderboard, 20261115000000_admin_users. « Allow anonymous sign-ins » doit être activé. Variables Vercel serveur : `SUPABASE_SERVICE_ROLE_KEY` (clé secrète `sb_secret_…`), `ADMIN_PASSCODE`, `ADMIN_SESSION_SECRET`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PHOTOS_DAILY_CAP=30`. Doc : `docs/SUPABASE.md`, `docs/BACKOFFICE.md`, `docs/GOOGLE_PHOTOS.md`, `docs/PHOTOS.md`.

## Ce qui n'est PAS dans le dépôt (reste sur le PC du fondateur)
`docs/private/` (business plan, étude de coûts), `.env.local`, pipeline d'icônes IA (ComfyUI dans `D:\fooder-ai`), photos originales, mémoire QG. Ne pas supposer qu'ils existent dans une session cloud.

## Backlog (état au 14/11/2026)
Audits dans `docs/audit/` (AUDIT_CODE, AUDIT_VISUEL, LIGHTHOUSE). Fait : vague 1 (tokens, Sheet, célébrations), onboarding court, comptes anonymes, backoffice, position/adresse/rayon, fil + recherche d'avis + commentaires modifiables, carte avec vrais coups de cœur, photos de la communauté dans la fiche, restos fermés masqués, tap seul pour ouvrir la fiche.
Reste : deck de swipe (tampon MIAM au doigt, cœur qui vole vers Favoris, fin de paquet en récap, brouillon d'onboarding), boutons MIAM/BOF dans la fiche, lot social (amis, groupe, défi, classement : doubles XP, plafond XP défis), allègement du bundle (LazyMotion, Supabase dynamique), fond d'écran (motif d'emojis Noto ou Magic UI : licences à relire sur les dépôts officiels), pages légales à compléter (« [À COMPLÉTER] » : éditeur, adresse, SIRET, e-mail), e-mail de connexion (nécessite nom de domaine + service d'envoi), publication Play Store (TWA, test fermé 12 testeurs × 14 jours : voir la roadmap du fondateur), liste de photos de plats envoyées par les restaurateurs (`scripts/import-restaurant-photos.mjs`).
