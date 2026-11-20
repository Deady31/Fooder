# Prompt pour la session locale (PC de Riyan) : suite, coût zéro, photos et vérification en production

> Usage : dans Claude Desktop, onglet Code, dossier Fooder, nouvelle session, coller :
> « `git checkout main && git pull`, puis lis `docs/PROMPT_LOCAL_SUITE.md` et exécute-le. Commence par le plan, ne code rien avant mon accord. »

## 0. Lis d'abord
`CLAUDE.md` (fait foi), `docs/DATA_QUALITY.md`, `docs/PHOTOS.md`, `docs/GOOGLE_PHOTOS.md`, les 6 dernières lignes de `docs/DECISION_LOG.md`. Ne relis plus ensuite.

## 1. État (20 novembre 2026, tout est dans `main`)
- **Adresses** : 100 % des fiches servies ont une adresse vérifiée (BAN, SIRENE, site), 2 362 fiches servies. **Quartiers** : 60 contours officiels.
- **Photos** : seules les vraies photos de plats sont servies (tri par vision, registre `data/photo-vision.json`), 386 fiches avec photo (16 %). Les autres montrent l'illustration Fooder.
- **Identité stricte des photos (décision du fondateur)** : AUCUNE photo générique sur une carte. Cause racine corrigée : le « plat typique » Wikimedia (`lib/dishes.ts`, `public/dishes`) attachait une photo de la cuisine à toute fiche (KFC avec un poulet rôti). Supprimé. Une image ne s'affiche que sur la fiche de l'établissement exact. `scripts/flag-shared-photos.mjs` écarte toute image partagée entre plusieurs fiches (y compris les agences d'une même chaîne : **plus aucune exception**). Tests : `tests/photoIdentity.test.ts` (échouent si une image est servie sur deux fiches).
- **Google** : ÉTEINT par défaut. Aucun appel sans `GOOGLE_PHOTOS_ENABLED=1`, même si la clé existe. Ne jamais l'activer sans l'accord écrit de Riyan.

## 2. RÈGLE N° 1 : COÛT ZÉRO (Riyan ne veut RIEN payer)
- **Interdit** : toute API payante ou à facturation (Google Places, Maps, Geocoding, Vision, tout fournisseur d'images ou d'IA avec clé). Aucun script ne lit `GOOGLE_PLACES_API_KEY`. Pas de service qui demande une carte bancaire.
- **Autorisé** : BAN (`api-adresse.data.gouv.fr`), SIRENE (`recherche-entreprises.api.gouv.fr`), les sites des restaurants (1 requête/s/site, robots.txt respecté), les données ouvertes, les scripts locaux. Les sous-agents Claude consomment le forfait Claude de Riyan (pas de facturation à la clé) : les utiliser **seulement** là où un script ne suffit pas, avec des lots (planches de 36), le plus petit modèle d'abord.
- **Avant toute action qui pourrait coûter** : le dire et attendre un « ok ». Une dépense réelle connue : le nom de domaine (~12 €/an), à décider par Riyan.
- **Contrôle à faire dès le début, sans rien modifier sans accord** : vérifier avec Riyan, dans Vercel (Settings, Environment Variables) que `GOOGLE_PHOTOS_ENABLED` n'est PAS à `1`, et lui conseiller de **supprimer la clé Google** (Vercel et console Google Cloud) ou de mettre un quota et une alerte de budget à 0. Vérifier qu'aucune variable secrète n'est préfixée `NEXT_PUBLIC_`.
- Rappel (à vérifier sur les pages officielles) : Vercel Hobby, Supabase Free et Resend Free n'envoient pas de facture au-delà de leurs limites (ils bloquent ou mettent en pause) ; ne jamais passer à un plan payant ni ajouter de carte.

## 3. Tâches (dans l'ordre, un rapport de 12 lignes et un « ok » entre chaque)
**T1. Vérifier la production.** Une fois Vercel déployé : ouvrir `https://fooder-tawny.vercel.app` (ou le domaine), vérifier sur 10 fiches tirées au hasard + KFC, McDonald's, Tasty Crousty, Good Protein : adresse présente, quartier cohérent, jamais de photo générique, illustration quand pas de photo. Ne rien écrire dans la base de production (`NEXT_PUBLIC_DISABLE_CLOUD=1` en local).

**T2. Plus de photos, gratuitement, sans jamais tricher sur l'identité.**
- Rejouer la récupération sur les sites **inaccessibles** (403, rendu JavaScript) avec le navigateur Playwright déjà installé (gratuit), mêmes filtres et mêmes règles que `scripts/photos-candidates.mjs`.
- Pages « nos restaurants / trouver un restaurant » des chaînes : une photo n'est acceptée que si la page est celle de CE restaurant (adresse ou ville sur la page = adresse vérifiée de la fiche). Sinon refus.
- Ne pas utiliser Instagram ni Facebook en automatique (conditions de ces sites). Les photos des réseaux sociaux passent par la relance du restaurateur avec son accord écrit.
- Après chaque lot : `node scripts/flag-shared-photos.mjs`, `npx vitest run`, planche de contrôle de 100 photos pour Riyan. Objectif : 0 image qui n'est pas un plat, 0 image partagée entre fiches.
- Relance des restaurateurs : `data/review/relance-restaurateurs.csv` et `docs/MESSAGE_RESTAURATEURS.md` existent. Aider Riyan à les envoyer (par vagues de 20, par WhatsApp), puis importer les photos reçues avec `scripts/import-restaurant-photos.mjs` (classe `restaurant`, accord écrit conservé dans `data/photo-consent.json`).

**T3. Qualité restante des données.**
- Doublons : 139 noms apparaissent plusieurs fois ; confirmer que chaque agence a sa propre adresse vérifiée et qu'aucun vrai doublon n'est affiché.
- Cohérence cuisine : une photo de pizza sur un restaurant de sushis ne doit pas passer (limite notée dans `docs/DATA_QUALITY.md`) : ajouter le contrôle sur les photos servies (vision, un lot).
- Mettre à jour `docs/DATA_QUALITY.md` (chiffres avant/après) et `docs/DECISION_LOG.md`.

**T4. Seulement si Riyan le demande** (ne pas commencer sinon) : bouton « Y aller » (Google Maps, Waze, Apple Maps, Uber par liens, sans clé ni coût), rappel « tu y es allé ? » après un clic sur l'itinéraire, nouveautés saisies à la main par les restaurateurs.

## 4. Règles de travail (rappel)
- Réponses courtes en français ; preuve > promesse ; aucune fausse donnée ; aucune clé affichée ni committée ; ne jamais afficher le contenu de `.env.local`.
- Travailler sur une branche `suite-donnees`, commits petits (`git add <fichier>`, jamais `git add -A`), `tsc` + tests + build sur l'index exporté (`git checkout-index -a --prefix=<dossier-temp>/`), **pousser sur `main` seulement avec l'accord explicite de Riyan** (pousser = déployer).
- Orchestration : scripts pour tout le mécanique (zéro token), petit modèle pour le tri par planches, modèle moyen pour les cas ambigus, un seul passage du plus gros modèle pour une revue finale. Chaque sous-agent écrit dans un fichier et ne renvoie que ≤ 10 lignes. Ne jamais coller de listes de fiches dans la conversation.
- Skills « ponytail » et « caveman » : les utiliser s'ils sont installés sur ce PC (`/skills`), sinon sorties minimales.
