# Quartiers de Toulouse

Le quartier affiché sur une fiche vient des **contours officiels** des grands quartiers de Toulouse, par point-dans-polygone. Il n'est plus deviné à partir de centres approximatifs.

## Source et licence
- Jeu de données : « Recensement population 2011 - Grands quartiers - Logement » (`toulouse_gq_logement_rp2011`), **Mairie de Toulouse**, https://data.toulouse-metropole.fr
- Licence : **Licence Ouverte v2.0 (Etalab)**, https://www.etalab.gouv.fr/licence-ouverte-open-licence/ : réutilisation libre, y compris commerciale, à condition de citer la source et la date de récupération.
- Citation dans l'appli : page `/legal/credits`. Date de récupération : 20 novembre 2026 (champ `retrievedAt` du fichier).
- On n'utilise que le **nom** et le **contour** de chaque quartier ; les statistiques du recensement sont ignorées.
- Autre jeu examiné : « Quartiers de démocratie locale » (20 secteurs, même licence). Écarté : moins fin, et ses noms sont des numéros.

## Fichiers
| Fichier | Rôle |
|---|---|
| `scripts/import-quartiers.mjs` | Télécharge le GeoJSON, remet les noms en français accentué (table `DISPLAY`, le script s'arrête si un nom manque), écrit le fichier compact. `--offline` relit `data/cache/quartiers-source.geojson`. |
| `data/quartiers-toulouse.json` | 60 quartiers, 6 026 points, ~115 Ko, coordonnées à 5 décimales (~1 m). Versionné. |
| `lib/quartiersGeo.ts` | `quartierAt(lat, lng)` : lancer de rayon (règle pair-impair, trous gérés), boîtes englobantes pour aller vite. **Serveur et scripts seulement.** |
| `lib/quartiers.ts` | Liste des 60 noms (`QUARTIERS`), légère, utilisable dans le navigateur (profil, exploration). Un test la compare aux contours. |
| `scripts/verify-addresses.mjs` | Calcule `q` de chaque fiche à la construction (`data/addresses-verified.json`). |

## Règles
- **Hors polygone : `null`**, rien n'est affiché (Blagnac, Labège, Colomiers…). Jamais « le quartier le plus proche ».
- Si l'adresse vérifiée est dans une autre commune que Toulouse, `q` est `null` même si la position tombe de justesse dans un polygone (cas d'une fiche de Colomiers en limite de Saint-Martin-du-Touch).
- Le quartier est **calculé à la construction**, servi avec la fiche (`Restaurant.quartier`), puis lu tel quel : check-in (`lib/visits.ts`), groupe, défi. Les anciens likes enregistrés avant ce changement n'ont pas de quartier (rien n'est affiché).
- Mettre à jour les contours : `node scripts/import-quartiers.mjs`, puis `node scripts/verify-addresses.mjs --phase=decide` (sans réseau), puis les tests.

## Limites connues
- Les « grands quartiers » sont un découpage statistique de 2011 : « Zones d'activités Sud » en fait partie sans être un quartier d'habitation.
- L'exploration du profil (« quartiers explorés ») compte maintenant sur 60 quartiers au lieu de 18. Les visites déjà enregistrées gardent leur ancien nom de quartier (ex. « Wilson », « Jean-Jaurès ») : il n'apparaît plus comme débloqué.
- Un quartier est calculé pour la fiche, pas pour l'utilisateur.
