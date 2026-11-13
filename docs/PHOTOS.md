# Photos des restaurants — ce qui a été récupéré

## Résultat (13/11/2026)

| | |
|---|---|
| Restaurants/points de vente dans `data/toulouse-places.json` | 5 360 |
| Dont un site web renseigné dans OSM | 3 347 |
| **Photos réelles récupérées (gratuit)** | **1 254** (23 % du total, 37 % des sites) |
| Poids | 86 Mo · 70 Ko par photo en moyenne (800 px, JPEG q72) |
| Dont vrais restaurants (hors fast-food) | 816 |

Où : `public/restaurant-photos/<id>.jpg` (l'id est celui d'OSM, ex. `osm-n252267351.jpg`).
Table prête à importer : `data/photos-local.json` → `{ '<id>': { src, credit, page } }`.
Manifeste complet : `data/restaurant-photos.json` (source, dimensions, poids, page d'origine).

## Comment c'est fabriqué

1. `scripts/fetch-restaurant-photos.mjs` visite le site officiel de chaque restaurant (champ `w`),
   respecte `robots.txt`, lit `og:image` / `twitter:image` / JSON-LD / la plus grande `<img>`,
   vérifie les dimensions réelles de l'image et garde la meilleure.
2. `scripts/convert-photos.ps1` (ou ffmpeg pour les WebP) : 800 px, JPEG q72, EXIF supprimé.
3. `scripts/photo-stats.ps1` + `scripts/filter-photos.mjs` : écartent les logos, aplats, images
   blanches ou noires (111 rejetées, déplacées dans `data/photos-rejetees`).
4. `scripts/finalize-photos.mjs` régénère `data/photos-local.json`.
5. `scripts/build-preview.mjs` génère `data/apercu-photos.html` (12 cartes avec les vraies photos).

Relancer : `node scripts/fetch-restaurant-photos.mjs --stage=discover` puis les étapes 2 à 4.

## Ce qui a échoué (et pourquoi)

| Cause | Nombre | Commentaire |
|---|---|---|
| Site injoignable | 720 | domaines expirés ou fermés, fréquent dans OSM |
| Image refusée | 470 | trop petite, logo, mauvais ratio |
| Aucune image | 239 | site sans visuel exploitable |
| 404 / 403 / robots | 479 | page morte, anti-bot, ou crawl interdit |
| Pas de site du tout | 2 013 | rien à scraper |

Les restaurants sans photo gardent le plat typique (Wikimedia) ou l'illustration : aucun trou visuel.

## Branchement (fait le 13/11/2026)

Nouvelle source `photoSource: 'site'` : priorité 2, entre les photos des foodies (3) et le plat
typique (1). Un resto avec une photo de son site n'affiche donc plus une illustration.

| Fichier | Changement |
|---|---|
| `lib/sitePhotos.ts` | **nouveau** — expose `SITE_PHOTOS` depuis `data/photos-local.json` |
| `data/mockRestaurants.ts` | `photoSource` accepte `'site'` |
| `lib/photoPriority.ts` | `RANK` = community 3, site 2, dish 1, google 0 ; `galleryFor` garde la photo `site` |
| `lib/osm.ts` | `osmToRestaurant` applique la photo du site avant le plat typique |
| `lib/photoInvite.ts` | plus d'invite « pas encore de vraie photo » quand une photo du site existe |
| `components/ui/lightboxMath.ts` | crédit « Photo du restaurant · <domaine> » |
| `components/swipe/RestaurantCard.tsx` | badge « Photo du restaurant » |
| `components/swipe/DetailSheet.tsx` | titre de galerie « Le restaurant » + mention de la source |
| `app/resto/[id]/page.tsx` | `alt` et crédit adaptés |

Vérifié : `tsc --noEmit` OK, **733 tests / 38 fichiers** OK, `next build` OK, et
`/resto/osm-n252267351` sert bien `/restaurant-photos/osm-n252267351.jpg` en production.

## À savoir avant de publier

- **Droit d'auteur** : ces photos appartiennent aux restaurants (ou à leurs photographes). Pour un
  démo/portfolio, risque quasi nul ; pour une app monétisée, le plus sûr est de demander l'accord
  (le crédit et le lien source sont déjà dans `photos-local.json`, donc un retrait est immédiat).
- **Poids** : 86 Mo dans `public/` alourdissent le dépôt et le déploiement Vercel. Avant la prod :
  soit les sortir de git et les héberger sur Supabase Storage, soit ne garder que les restos des
  villes couvertes.
- **Qualité** : ~15 % sont des visuels de marque (bannière, logo, capture d'app) plutôt que des
  plats. Les fichiers rejetés automatiquement sont dans `data/photos-rejetees`, le reste est
  supprimable à la main : `data/restaurant-photos.json` donne le nom de chaque photo.

## Consentement des restaurateurs (règle produit)

Sans accord d'un restaurant, sa photo n'est PAS affichée. Les 1 254 photos de `public/restaurant-photos/` restent
sur le disque (dossier ignoré par git) et ne servent que de réserve pour `--from-site`.

- `data/photo-consent.json` : `{ version, restaurants: { "<id OSM>": { name, consentedAt, source, note? } } }`. Vide au départ.
  Retrait d'un accord = supprimer l'entrée (la photo disparaît aussitôt).
- `data/photos-consented.json` : `{ id: { src, kind: 'dish'|'site', credit, consentedAt } }`, généré par le script.
- `public/restos/<id>.jpg` : photos consenties (900 px, léger, suivi par git).
- `lib/sitePhotos.ts` n'expose une photo que si l'id est dans le consentement ET dans la table.

### Import

Dépose les fichiers reçus dans `data/photos-restaurateurs/`, écris un CSV (`;`) :

```
nom;fichier;type;date;moyen
Chez Éloïse;eloise-cassoulet.jpg;plat;2026-11-13;téléphone
Le Bistrot;;site;2026-11-14;whatsapp
```

- `type` : `plat` (envoyé par le restaurateur) ou `site` ; `moyen` : téléphone, whatsapp, email, autre ; `date` AAAA-MM-JJ.
- `fichier` vide + `--from-site` : reprend `public/restaurant-photos/<id>.jpg` (type site).
- `nom` peut être un id OSM (pour lever une ambiguïté).

```
node scripts/import-restaurant-photos.mjs liste.csv              # dry-run (défaut) : sûr / AMBIGU / introuvable
node scripts/import-restaurant-photos.mjs liste.csv --apply      # écrit (refuse tout si une ligne est ambiguë)
node scripts/import-restaurant-photos.mjs liste.csv --apply --from-site
```

Redimensionnement : `sharp` s'il est installé, sinon `ffmpeg`. Une photo `plat` n'est jamais écrasée par une photo `site`.

### Priorité d'affichage (`PHOTO_PRIORITY` dans `lib/photoPriority.ts`)

plat du restaurant > photo d'un foodie > photo du site (consentie) > plat typique (Wikimedia) > illustration.
Google n'apparaît jamais sur la carte.
