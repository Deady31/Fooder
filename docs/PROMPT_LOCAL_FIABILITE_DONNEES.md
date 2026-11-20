# Prompt pour la session locale (PC de Riyan) : fiabilité des données (adresses, quartiers, photos de plats)

> Usage : ouvrir une session Claude Code dans le dossier du dépôt sur le PC, puis coller :
> « `git fetch`, puis lis `docs/PROMPT_LOCAL_FIABILITE_DONNEES.md` (branche `main-ade7nq` si le fichier n'est pas encore dans `main`) et exécute-le. Commence par l'étape 0 et le plan, ne code rien avant mon accord. »

---

## 0. Contexte et objectif

Fooder est une PWA de swipe de restaurants à Toulouse (lis `CLAUDE.md` en entier d'abord : il fait foi pour les règles, les commandes et les interdits).

**Le problème qui bloque la mise en production : la fiabilité des informations affichées.**
1. **Adresses** : certaines fiches n'ont pas d'adresse, certaines ont un mauvais quartier.
2. **Photos** : la carte de swipe doit montrer **un plat du restaurant** (priorité : plat envoyé par le restaurant > photo d'utilisateur > photo du site du restaurant > plat typique libre de droit crédité > illustration).

Riyan a l'accord des restaurateurs du Grand Toulouse (oral, `data/photo-consent.json`, section `blanket`).

### Chiffres mesurés (2 715 fiches présentables, types `restaurant` et `fast_food`)
- 719 ont une photo servie (`public/restos/<id>.webp`), 1 996 n'en ont pas : 1 394 avec site web, 521 avec seulement un téléphone, 81 sans aucun contact.
- 244 n'ont aucune adresse (242 viennent d'OSM, 2 d'Overture) ; 248 n'ont pas de code postal.
- Le quartier est calculé par `lib/quartiers.ts` : centre le plus proche parmi 18 centres approximatifs, portée 1,3 km. Quand l'adresse manque, `osmToRestaurant` (`lib/osm.ts`) affiche « Quartier X, Toulouse » **comme si c'était l'adresse** : à supprimer.
- 139 noms apparaissent plusieurs fois (433 fiches), surtout des chaînes : chaque agence doit avoir sa propre adresse vérifiée.
- Cas témoin : « Tasty Crousty » a deux fiches OSM, `osm-n2444345516` (Capitole, sans adresse) et `osm-n14140901448` (Patte d'Oie). Riyan dit que le quartier affiché est faux. Il faut établir avec des preuves laquelle (ou lesquelles) est réelle. Même vérification pour Crousty One (`osm-n2450406603`, sans adresse).
- Données : `data/toulouse-places.json` est **généré** (OSM + Overture, `scripts/build-places.mjs`). Ne pas le retoucher à la main : passer par une surcouche versionnée (voir étape 2) intégrée au build ou à la lecture.

## 1. Règles non négociables

**Du projet (`CLAUDE.md`)**
- Réponses courtes, en français, l'action d'abord. Preuve > promesse : lancer, vérifier, montrer.
- **Aucune fausse donnée** dans l'interface. Mieux vaut une fiche absente qu'une fiche fausse.
- Aucune clé affichée, journalisée ni committée. Tester sans polluer la base de production : `NEXT_PUBLIC_DISABLE_CLOUD=1 npm run dev -- -p 3100`.
- Ne pas lancer `next build` dans le dossier de travail pendant qu'un serveur de dev tourne : exporter l'index (`git checkout-index -a --prefix=<dossier-temp>/`), relier `node_modules`, construire dans la copie.
- Commits petits, `git add <fichier>` un par un, jamais `git add -A`. Pied de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Pousser sur `main` = déployer en production** : travailler sur une branche `fiabilite-donnees`, ne pousser sur `main` qu'avec l'accord explicite de Riyan. Windows : pas de ligne shebang `#!` dans les scripts importés par vitest.

**Limites légales (décision déjà prise : ne pas les contourner)**
- **Interdit** : chercher, copier ou stocker des images depuis Google Images, Google Maps ou l'API Google Places pour les mettre sur la carte. Les conditions de Google l'interdisent et ces photos appartiennent souvent à des clients, pas au restaurateur. Google reste uniquement dans la fiche, à l'ouverture (`/api/place-photos`, plafond `GOOGLE_PHOTOS_DAILY_CAP`), jamais stocké.
- **Autorisé** : photos des **propres sites** des restaurants (accord blanket), photos envoyées par le restaurateur (`scripts/import-restaurant-photos.mjs`), photos de la communauté. Respecter `scripts/block-photo.mjs` (retrait, mauvaise photo).
- Respect des serveurs : 1 requête par seconde et par site au plus, délai d'attente, `User-Agent` identifiable, ne pas contourner de blocage.

## 2. Étapes

Travailler dans cet ordre. À la fin de chaque étape : tests + `tsc` verts, rapport court à Riyan, **attendre son feu vert pour la suivante**.

### Étape 0 : synchronisation et plan (aucun code de production)
1. `git fetch`. **La branche `main-ade7nq` (session cloud) contient des commits pas encore dans `main`** (catégorie Protéines, recherche dans les filtres, Pizza, etc.). Demande à Riyan s'il faut les fusionner dans `main` avant de partir, pour éviter les conflits (notamment `lib/osm.ts`).
2. Crée la branche `fiabilite-donnees` à partir de la bonne base.
3. Lis `docs/PHOTOS.md`, `docs/GOOGLE_PHOTOS.md`, `scripts/fetch-restaurant-photos.mjs`, `scripts/filter-photos.mjs`, `scripts/finalize-photos.mjs`, `scripts/photo-quality.mjs`, `scripts/build-consented-photos.mjs`, `scripts/build-places.mjs`, `lib/osm.ts`, `lib/quartiers.ts`. Ne relis plus ensuite.
4. Écris un plan (≤ 40 lignes) et attends l'accord.

### Étape 1 : audit des adresses (lecture seule, aucun appel qui coûte)
Produis `data/review/audit-adresses.json` (dossier `data/review/` et `data/cache/` **hors git** : ajoute-les au `.gitignore`). Pour chaque fiche présentable :
- adresse présente ? numéro de rue ? code postal ? commune ?
- cohérence nom/adresse entre OSM et Overture quand les deux existent (`s: 'b'`).
- doublons : même nom normalisé à moins de 50 m (à fusionner) ; même nom à plus de 50 m (agences distinctes).
Résume en 10 lignes (compteurs par catégorie de problème).

### Étape 2 : adresses vérifiées (scripts, zéro token pour le mécanique)
Créer `scripts/verify-addresses.mjs` (reprenable, idempotent, avec cache disque dans `data/cache/`).
1. **BAN** (Base Adresse Nationale, gratuite, sans clé) : `https://api-adresse.data.gouv.fr/search/` et `/reverse/`. Préférer le géocodage **par lot CSV** (`/search/csv/`). Pour chaque fiche avec adresse : géocoder, comparer au couple (`la`, `ln`) de la fiche ; **écart > 150 m ⇒ `coord_mismatch`**.
2. **SIRENE** via l'API publique « Recherche d'entreprises » (`https://recherche-entreprises.api.gouv.fr/search`, gratuite, sans clé, ≈ 7 requêtes/s max) : pour les fiches sans adresse ou en désaccord, chercher le nom + commune, activités de restauration (`56.10A`, `56.10B`, `56.10C`, `56.30Z`…). Accepter un établissement seulement si la similarité de nom est forte **et** sa position est à moins de 200 m du point de la fiche. Sinon `needs_review`.
3. **Site web du restaurant** (celles qui en ont un) : corroborer ou compléter via JSON-LD `PostalAddress`, balise `<address>`, pied de page.
4. **Précédence** de la source de l'adresse affichée : OSM validée par BAN (≤ 150 m) > Overture validée > SIRENE > site web. Un « reverse BAN » (adresse la plus proche d'un point) n'est **jamais** une adresse de resto : le noter `approx`, ne pas l'afficher.
5. **Surcouche versionnée** `data/addresses-verified.json` : `{ id: { a, q, av: 'ok'|'approx'|'none', src } }`, fusionnée par `build-places.mjs` (ou à la lecture dans `lib/osm.ts`, au plus simple qui reste testable). Ne pas retoucher `toulouse-places.json` à la main.
6. **Doublons et chaînes** : fusionner les vrais doublons ; garder une fiche par agence avec **sa** propre adresse vérifiée. Résoudre « Tasty Crousty » et « Crousty One » avec preuves (source, distance), ou les lister dans `data/review/a-valider-par-riyan.csv` (id, nom, candidats, raison).
7. **Barrière** : `isPresentable` (`lib/osm.ts`) exige une adresse vérifiée (`av === 'ok'`). **Supprimer le repli « Quartier X, Toulouse » affiché comme adresse.** Avant de livrer, afficher : nombre de fiches avant/après, par cause de retrait.
8. Tests : adresse obligatoire pour toute fiche servie par l'API, aucune adresse « Quartier … » servie, cas Tasty Crousty, idempotence du script.

### Étape 3 : quartiers fiables
- Remplacer le calcul « centre le plus proche » par un vrai **point-dans-polygone** avec les contours des quartiers de Toulouse Métropole (données ouvertes, vérifier la licence et la citer dans `docs/`). Le quartier est calculé **à la construction des données** (champ `q`), pas à l'affichage.
- Hors polygone : `null` (rien d'affiché). Conserver l'API de `quartierFor` pour `DefiComposer`, `Groupe`, etc., ou migrer ses appels proprement.
- Tests : points connus (Capitole, Saint-Cyprien, Patte d'Oie, Purpan, Minimes…), point hors zone, cohérence avec l'adresse.

### Étape 4 : photos de plats
Cible : fiches présentables **sans photo et avec site web** (≈ 1 394), puis le reste.
1. Réutiliser le pipeline existant (`fetch-restaurant-photos.mjs` étapes `discover` puis `download`, `filter-photos.mjs`, `photo-quality.mjs`, `finalize-photos.mjs`, `convert-photos.ps1`). Les originaux restent sur le PC, **non versionnés**. Photos servies : `public/restos/<id>.webp`, manifeste et crédits comme dans `docs/PHOTOS.md`.
2. Candidats : `og:image`, JSON-LD `image`, images de pages menu/galerie. Exclure d'office : logos, cartes (`staticmap`, `maps.googleapis.com`), images < 600 px de large, doublons (hash perceptuel, y compris entre agences d'une même chaîne), bannières avec texte plein.
3. **Tri par vision, en lots** : planches-contacts de 36 images numérotées (`scripts/contact-sheet.ps1` existe). Un sous-agent **haiku** classe chaque image en JSON strict `{idx, classe: plat|facade|interieur|logo|carte|menu|personnes|autre, confiance}`. Garder `plat` avec confiance ≥ 0,8 ; les cas limites vont à un sous-agent **sonnet**. Garder la meilleure image par resto (netteté, taille).
4. **Contrôle humain** : à la fin, une planche de 100 photos tirées au hasard pour Riyan. Objectif : **0 image qui n'est pas un plat** dans l'échantillon. Sinon, resserrer le seuil et refaire.
5. **Fiches restantes** (téléphone seul ou rien) : produire `data/review/relance-restaurateurs.csv` (id, nom, téléphone, adresse vérifiée) et un message type WhatsApp (court, tutoiement, demande **par écrit** l'accord de réutiliser les photos et de recevoir une photo de plat). Pas de formulaire à construire maintenant.
6. Aucun appel à l'API Google Places pour stocker quoi que ce soit.

### Étape 5 : barrière de mise en production et tableau de bord
- `docs/DATA_QUALITY.md` : chiffres avant/après (adresses vérifiées, photos de plats, fiches retirées, fiches à valider).
- Tests sur les vraies données : 100 % des fiches servies ont une adresse vérifiée ; aucun quartier affiché comme adresse ; aucune photo servie de classe ≠ plat (d'après le manifeste).
- Vérifier le rendu dans le navigateur (320×568 et 375×812) sur 10 fiches tirées au hasard + les cas témoins ; captures dans le dossier temporaire.
- Build sur l'index exporté. **Attendre le feu vert de Riyan avant tout push sur `main`.**

## 3. Orchestration et économie de tokens

- **Toi (orchestrateur)** : décisions, intégration, commits. Tu ne lis **jamais** les données brutes : tu lis des rapports de ≤ 10 lignes.
- **Scripts (zéro token)** : géocodage, SIRENE, téléchargement, redimensionnement, hash, dédoublonnage, comptages. Tout ce qui est mécanique est un script, jamais un raisonnement.
- **Sous-agents** (paramètre `model` de l'outil Agent) :
  - `haiku` : tri de planches-contacts, extraction d'adresses depuis du texte de site, normalisation de noms ;
  - `sonnet` : cas ambigus (nom proche de plusieurs établissements), écriture de scripts et de tests ;
  - le modèle le plus fort : une seule revue finale (risques juridiques, cohérence), jamais pour du volume.
- Chaque sous-agent **écrit son résultat dans un fichier** (`data/review/…`) et ne renvoie que ≤ 10 lignes de résumé. Lots indépendants (par plage d'identifiants), lancés en parallèle. Arrêt dès qu'une confiance suffisante est atteinte.
- Ne jamais coller de listes de fiches dans la conversation : compteurs et 5 exemples au plus.
- **Skills « ponytail » et « caveman »** : Riyan les a mentionnés. Ils n'existaient pas dans la session cloud. Si tu les as sur ce PC (`/skills`), utilise-les ; sinon applique leur esprit (sorties minimales, données dans des fichiers) et dis-le-lui en une ligne.

## 4. Livrables, dans l'ordre
1. Plan (étape 0), validé par Riyan.
2. `audit-adresses` + compteurs (étape 1).
3. `scripts/verify-addresses.mjs`, `data/addresses-verified.json`, barrière `isPresentable`, tests (étape 2).
4. Quartiers par polygones (étape 3).
5. Photos de plats triées + échantillon de contrôle + CSV de relance (étape 4).
6. `docs/DATA_QUALITY.md`, mise à jour de `docs/DECISION_LOG.md` (une ligne par décision), `docs/PHOTOS.md` si le pipeline change (étape 5).

**Format de chaque rapport à Riyan** : ≤ 12 lignes : ce qui est fait (avec chiffres), ce qui reste, ce qui est douteux (à valider), la prochaine étape. Pas de promesse : seulement des preuves.
