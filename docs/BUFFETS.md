# Buffets à volonté de la métropole toulousaine

Envie « Buffet à volonté » dans « T'as envie de quoi ? » (icône `paella`, qu'aucun resto n'utilisait). Données : `data/buffets.json`, lues par `lib/buffets.ts`. Mise à jour : 2026-11-17.

## Règles
- **À volonté uniquement** : buffet, wok, sushi, grillades, churrasco, buffet végétarien. Pas les simples « buffets de salades » ni les formules où seule l'entrée ou le dessert est à volonté.
- **Confirmé** = formule attestée par au moins deux sources indépendantes. Une seule source, un lieu absent de la base ou une fermeture possible = **à confirmer** (pas affiché).
- **Pas de prix** : ils changent vite et plusieurs sources datent de 2019 à 2022.
- Un resto confirmé n'apparaît que si sa fiche est affichable (règle générale : cuisine ou horaires lisibles). Les restos fermés restent masqués comme ailleurs.
- Le nom ne prouve rien : « Buffet Himalaya » a une carte à la carte, il est exclu.

## Confirmés (15) : 13 affichés aujourd'hui
Royal Buffet (3 adresses : avenue d'Atlanta, avenue des États-Unis, route d'Espagne), Le Buffet du Grand Marché, Le Dynastie (Gramont), Saké Sushi (Labège), Papillons (route de Bayonne), Ô Cent Couverts, La Faim des Haricots (Puits Vert et Labège), La Bonita (churrasco), La Grilladelle, L'Aubrac, Maison Robert (ex-Marmites des îles), World Buffet (Portet-sur-Garonne).
Non affichés tant que la fiche manque de cuisine et d'horaires : Maison Robert, World Buffet.

## À confirmer (7), par un appel ou une visite
| Lieu | Pourquoi |
|---|---|
| Mosto Buffet (Plaisance-du-Touch) | Un annuaire le signale peut-être fermé |
| LaraClet' (Gramont) | Une seule source (2022) |
| Campanile (Labège) | Buffet d'hôtel, une seule source |
| La Faim des Haricots (Blagnac) | Deux fiches dans la base, à rapprocher d'un seul restaurant |
| World Fooding | Absent de la base, adresse à confirmer |
| La Table Indienne | Absent de la base, sources de 2019 |
| Aux Mille Saveurs (Plaisance-du-Touch) | Absent de la base |

## Exclus (vérifiés)
Buffet Himalaya (à la carte), Chez Riz (accompagnements seulement), Le Galeo (entrées ou desserts seulement), Agora (fermé).

## Mettre à jour
1. Modifier `data/buffets.json` : passer une entrée à `confirmed` avec au moins deux sources `https`, un `id` de `data/toulouse-places.json` et `verifiedAt`.
2. `npx vitest run tests/buffets.test.ts` : le test vérifie ids, sources, dates et la règle des deux sources.
3. Un lieu absent de la base doit d'abord y être ajouté (`scripts/build-places.mjs`), puis référencé par son id.

## Limites
- Les sources sont des annuaires et des articles : certaines datent de 2019 à 2025. Rien n'a été vérifié sur place ni par téléphone.
- Labège est dans l'agglomération du Sicoval, pas dans Toulouse Métropole : il est inclus car déjà dans la base des lieux.
