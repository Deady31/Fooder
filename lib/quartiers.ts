/**
 * Quartiers de Toulouse : les 60 « grands quartiers » officiels (Mairie de Toulouse, Licence Ouverte v2.0, voir docs/QUARTIERS.md).
 * Liste légère, sûre côté navigateur. Les contours (point-dans-polygone) sont dans lib/quartiersGeo.ts, réservé au serveur et aux scripts :
 * le quartier d'une fiche est calculé à la construction des données et servi avec elle (Restaurant.quartier).
 * Un test vérifie que cette liste est identique aux contours (tests/quartiers.test.ts).
 */
export interface Quartier {
  name: string;
}

export const QUARTIER_NAMES: readonly string[] = [
  'Amidonniers',
  'Arènes',
  'Arnaud Bernard',
  'Bagatelle',
  'Barrière-de-Paris',
  'Basso-Cambo',
  'Bellefontaine',
  'Bonnefoy',
  'Capitole',
  'Carmes',
  'Casselardit',
  "Château-de-l'Hers",
  'Compans',
  'Côte Pavée',
  'Croix-Daurade',
  'Croix-de-Pierre',
  'Empalot',
  'Faourette',
  'Fer-à-Cheval',
  'Fontaine-Lestang',
  'Ginestous',
  'Gramont',
  'Guilhémery',
  'Jules Julien',
  'Juncasse - Argoulets',
  'La Cépière',
  'La Fourguette',
  'La Terrasse',
  'Lalande',
  'Lardenne',
  'Le Busca',
  'Les Chalets',
  'Les Izards',
  'Les Pradettes',
  'Marengo - Jolimont',
  'Matabiau',
  'Minimes',
  'Mirail-Université',
  'Montaudran - Lespinet',
  'Papus',
  "Patte d'Oie",
  'Pont-des-Demoiselles',
  'Pouvourville',
  'Purpan',
  'Ramier',
  'Rangueil - CHR - Facultés',
  'Reynerie',
  'Roseraie',
  'Saint-Agne',
  'Saint-Aubin - Dupuy',
  'Saint-Cyprien',
  'Saint-Étienne',
  'Saint-Georges',
  'Saint-Martin-du-Touch',
  'Saint-Michel',
  'Saint-Simon',
  'Sauzelong - Rangueil',
  'Sept Deniers',
  'Soupetard',
  "Zones d'activités Sud",
];

export const QUARTIERS: Quartier[] = QUARTIER_NAMES.map(name => ({ name }));
