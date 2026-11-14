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

## Consentement et déploiement (mis à jour le 14/11/2026)

**Accord général** : le fondateur a obtenu l'accord oral des restaurateurs de toute la zone Grand Toulouse. Il est
consigné dans `data/photo-consent.json > blanket` (`active`, `scope: 'grand-toulouse'`, `consentedAt`, `source`, `note`).

Une photo est affichée si **(id dans `restaurants` OU `blanket.active`) ET id absent de `revoked` ET id absent de
`data/photo-blocklist.json`** (règle dans `lib/sitePhotos.ts`, testée dans `tests/restaurantPhotos.test.ts`).
Passer `blanket.active` à `false` rétablit le refus par défaut (seuls les accords individuels restent).

### Retirer une photo ou un restaurant

```
node scripts/block-photo.mjs osm-n250665866 "logo"            # mauvaise photo (qualité) -> photo-blocklist.json
node scripts/block-photo.mjs osm-n250665866 --revoke          # le restaurant retire son accord -> consent.revoked
node scripts/block-photo.mjs osm-n250665866 --undo [--revoke] # annule
```

Effet au prochain déploiement. Aucun fichier image n'est supprimé. `data/apercu-photos.html` affiche l'id sous chaque vignette.

### Fabrication des photos servies

```
node scripts/build-consented-photos.mjs [--limit=N] [--dry-run] [--size=720] [--quality=68] [--no-auto-block] [--force]
node scripts/build-preview.mjs        # planche de contrôle data/apercu-photos.html
```

1. Écarte les visuels de marque probables (`scripts/photo-quality.mjs`) dans `data/photo-blocklist.json`
   (entrées `source:'manual'` jamais touchées ; les `auto` sont recalculées).
2. Convertit `public/restaurant-photos/<id>.jpg` (originaux, jamais modifiés) en `public/restos/<id>.webp`
   (720 px max, qualité 68, EXIF supprimé) avec ffmpeg. Les WebP déjà présents sont conservés (`--force` pour refaire).
3. Écrit `data/photos-consented.json` : `{ id: { src, kind, credit (domaine), page, consentedAt } }`. Les entrées
   `kind:'dish'` (plats envoyés par les restaurateurs) sont conservées et gardent la priorité.

Résultat : 1 075 photos, **40 Mo** (limite 45 Mo ; sinon `--size=640 --quality=60`). `public/restos/` est suivi par git ;
`public/restaurant-photos/`, `data/photos-raw/`, `data/photos-restaurateurs/` restent ignorés.

### Filtrage qualité : ce que les heuristiques savent et ne savent pas

Écartées : **179 sur 1 254 (14 %)** : ratio largeur/hauteur extrême (> 2,2 ou < 0,6), très peu de couleurs, image presque
unie, PNG graphique, poids très faible, mot suspect dans le nom du fichier (logo, banner, header, menu, carte, capture,
flyer, façade, devanture, exterieur…). Rapport seul : `node scripts/filter-photos.mjs`.

**Elles ne savent pas reconnaître « un plat »** : une façade, une salle, une photo de groupe ou un portrait
de chef sans mot-clé dans le nom passent ; un bon plat en bannière large est écarté à tort. La planche de contrôle
(`data/apercu-photos.html`, section « écartées » puis « gardées ») sert à corriger à la main avec `block-photo.mjs`.

### Import (accords individuels / plats envoyés)

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
