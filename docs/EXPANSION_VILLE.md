# Ajouter une ville : extraction des restaurants

Date : 2026-11-13. Script : `scripts/extract-city.mjs`.

## Comment Toulouse a été produit (constaté dans le dépôt)

1. `scripts/import-osm.mjs` : une requête Overpass sur la boîte englobante de Toulouse Métropole (`43.48,1.28,43.73,1.64`) → `data/raw/osm.json`.
2. `scripts/import-overture.py` : lecture des fichiers Parquet d'Overture Maps (même boîte) avec DuckDB → `data/raw/overture.json` (adresses, téléphones, sites).
3. `scripts/build-places.mjs` : fusion et dédoublonnage (même nom à moins de 70 m) → `data/toulouse-places.json` (5 360 lieux).
4. `scripts/extract-osm-diets.mjs` : une requête Overpass de plus pour ajouter `dt` (régimes déclarés).

`scripts/extract-city.mjs` regroupe les étapes 1 et 4 pour n'importe quelle ville, en **une seule requête** Overpass, et écrit directement au format final.

## Format produit (identique à `data/toulouse-places.json`)

| Champ | Sens |
|---|---|
| `id` | `osm-` + type (`n`, `w`, `r`) + identifiant OSM |
| `n`, `k`, `c` | nom, type (`restaurant`, `fast_food`, `cafe`, `bar`, `pub`, `ice_cream`), cuisine OSM brute |
| `la`, `ln` | latitude, longitude (6 décimales ; centre pour les bâtiments) |
| `a`, `h`, `w`, `t` | adresse, horaires OSM bruts, site, téléphone |
| `d` | 1 si végétarien déclaré |
| `s` | source : `o` = OSM seul (`b` = fusionné avec Overture, `v` = Overture seul, après `build-places`) |
| `dt` | régimes déclarés (`vegan`, `vegetarian`, `halal`, `gluten_free`), absent si aucun ; mêmes règles que `extract-osm-diets.mjs` |

## Utilisation

```bash
# 1. Vérifier la requête sans rien appeler
node scripts/extract-city.mjs --city bordeaux --bbox 44.79,-0.66,44.92,-0.52 --dry-run

# 2. Extraire (une requête) -> data/bordeaux-places.json
node scripts/extract-city.mjs --city bordeaux --bbox 44.79,-0.66,44.92,-0.52

# Variante : commune entière par son nom OSM (limite administrative, admin_level 8)
node scripts/extract-city.mjs --city "Albi" --area
```

Options : `--out <fichier>`, `--force` (écraser un fichier existant), `--kinds restaurant,fast_food`, `--endpoint <url>/api/interpreter`.
La bbox est au format Overpass **sud,ouest,nord,est**. Les coordonnées ci-dessus sont un exemple : relever la boîte de la métropole visée sur openstreetmap.org (bouton « Exporter ») avant de lancer.
Pour ajouter un contact au User-Agent (recommandé par les opérateurs Overpass) : variable d'environnement `FOODER_CONTACT`.

## Garde-fous (politique Overpass)

- **Une requête** par exécution ; une seconde tentative seulement en cas d'échec, **après 30 s de pause**, jamais en parallèle.
- User-Agent explicite : `fooder-extract-city/1.0 (one-off city extraction, 1 request)`.
- Zone plafonnée à 0,6° × 0,6° (Toulouse Métropole ≈ 0,25° × 0,36°). Au-delà, découper.
- Refuse d'écrire `data/toulouse-places.json`, refuse d'écraser un fichier existant sans `--force`, n'écrit rien si 0 lieu.
- Rappel (wiki OSM, `docs/PRIX_VERIFIES.md`) : l'instance publique tolère un usage ponctuel ; pour un usage commercial régulier (rafraîchissement automatique), utiliser un serveur Overpass propre ou payant, ou un extrait Geofabrik.

## Test réalisé le 2026-11-13

Petite zone du centre de Toulouse (`43.6030,1.4420,43.6060,1.4460`, ~300 m de côté), sortie dans un dossier temporaire (pas dans `data/`) :
- 1re tentative : HTTP 502 de `overpass-api.de` ; pause de 30 s ; 2e tentative sur `lz4.overpass-api.de` réussie. **2 requêtes au total.**
- **71 lieux**, tous présents avec le même `id` dans `data/toulouse-places.json` ; aucune clé hors format.
- Écarts attendus sur `c`, `w`, `t` (7 à 18 fiches) : ces champs ont été complétés par Overture dans le fichier de Toulouse, ou modifiés dans OSM depuis. 1 écart sur `d`/`dt` : le nouveau script dérive `d` de `dt` (vegan ⇒ végétarien), l'ancien seulement de `diet:vegetarian`.

## Ce que le script ne fait pas (reste à faire pour une vraie ville)

| Étape | Pourquoi | Comment |
|---|---|---|
| Enrichir avec Overture | À Toulouse, Overture a apporté adresses, téléphones et des lieux absents d'OSM | Paramétrer la bbox de `scripts/import-overture.py` (aujourd'hui en dur) puis adapter `build-places.mjs` (chemins d'entrée et de sortie en dur) |
| Brancher la ville dans l'appli | L'API importe un seul fichier (`app/api/restaurants/route.ts`), la route photos est bornée à Toulouse, les quartiers sont ceux de Toulouse (`lib/quartiers.ts`) | Un fichier ou une table par ville, choisi selon la position ; voir `docs/ECHELLE_COUTS.md` § c-2 (tuiles statiques) |
| Contrôle qualité | Seules les fiches avec cuisine et horaires lisibles sont proposées (`isPresentable`, `lib/osm.ts`) | Le script affiche la part de fiches avec cuisine et horaires ; vérifier 50 fiches à la main |
| Attribution | Données © contributeurs OpenStreetMap (ODbL), Overture (CDLA Permissive 2.0) | Déjà créditées dans l'appli (`app/legal/credits`) |
