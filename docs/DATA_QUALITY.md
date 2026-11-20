# Qualité des données — avant / après (20 novembre 2026)

Fiches servies = restaurants et fast-foods présentables dans le Grand Toulouse.

| Mesure | Avant | Après |
|---|---|---|
| Fiches servies | 2 715 | **2 362** (353 retirées : adresse non vérifiable) |
| Adresse complète et vérifiée (BAN / SIRENE / site) | 75 % | **100 %** (barrière dans `isPresentable`) |
| Adresse « Quartier X » servie en guise d'adresse | oui | **jamais** |
| Quartier | 18 centres approximatifs (rayon 1,3 km) | **60 grands quartiers officiels** (point-dans-polygone), rien hors Toulouse |
| Fiches avec photo servie | 658 (28 %) | **386 (16 %)** |
| …dont photo qui est un plat (vision) | ~40 % | **100 %** (planche de contrôle de 100 photos : 0 hors-sujet) |

La baisse du nombre de photos est voulue : plus de la moitié des anciennes photos étaient des logos, façades, salles, menus ou personnes. Mieux vaut l'illustration de secours qu'une façade sur une carte.

## Chaîne de traitement des photos (scripts/photos-*.mjs)
1. `photos-candidates.mjs` : images des sites des restaurants (og:image, JSON-LD, pages menu/galerie), 1 requête/s/site, robots.txt respecté, jamais Google ni réseaux sociaux ; filtres taille (≥ 600×400), ratio, aplat, doublons (empreinte dHash).
2. `photos-sheets.mjs` : planches numérotées de 36 vignettes ; tri par vision (sous-agents : haiku en premier passage, sonnet pour les cas ambigus et le contrôle strict final). Classes : plat, facade, interieur, logo, carte, menu, personnes, autre. Registre versionné : `data/photo-vision.json`.
3. `photos-merge.mjs` → `photos-select.mjs` : une meilleure photo « plat » par fiche, conversion WebP 720 px, images partagées entre restaurants de noms différents écartées (agences d'une même chaîne : gardées), photos non-plat retirées via la blocklist (`source: vision`).
4. `photos-control.mjs` : planche de 100 photos au hasard pour contrôle humain. `photos-relance.mjs` : liste des restaurateurs à relancer.

Chaque photo servie porte sa classe (`vision` dans `data/photos-consented.json`). Tests : `tests/photosData.test.ts`, `tests/photoSelect.test.ts`.

## Limites connues
- Le modèle de vision dit « c'est un plat », pas « c'est le plat de CE restaurant » : on fait confiance au site enregistré sur la fiche. Agences d'une chaîne : même image possible (voulu).
- Pas de contrôle cuisine/photo (pizza sur un restaurant de sushis).
- Beaucoup de sites inaccessibles (domaines morts, 403/404, rendu JavaScript) : ces fiches passent par la relance (`data/review/relance-restaurateurs.csv`, message dans `docs/MESSAGE_RESTAURATEURS.md`).
- Le tri par vision est probabiliste : le registre `data/photo-vision.json` permet de rejouer ou corriger ; une mauvaise photo se bloque avec `node scripts/block-photo.mjs <id> "raison"`.
