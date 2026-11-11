import type { Restaurant } from '../data/mockRestaurants';
import { formatMeters, haversine } from './geo';
import { parseOsmHours } from './osmHours';
import { quartierFor } from './quartiers';

export { formatMeters, haversine };

/** Enregistrement compact produit par scripts/import-osm.mjs */
export interface OsmRecord {
  id: string;
  n: string; // nom
  k: string; // amenity
  c: string; // cuisine
  la: number;
  ln: number;
  a: string; // adresse
  h: string; // opening_hours
  w: string; // site web
  d: 0 | 1; // végétarien
}

const CUISINE_FR: Record<string, string> = {
  pizza: 'Pizzeria', burger: 'Burger', kebab: 'Kebab', sushi: 'Japonais', japanese: 'Japonais',
  chinese: 'Chinois', thai: 'Thaï', vietnamese: 'Vietnamien', indian: 'Indien', italian: 'Italien',
  french: 'Français', regional: 'Terroir', mexican: 'Mexicain', lebanese: 'Libanais', greek: 'Grec',
  turkish: 'Turc', sandwich: 'Sandwich', coffee_shop: 'Café', crepe: 'Crêperie', vegetarian: 'Végétarien',
  vegan: 'Vegan', seafood: 'Poissons', steak_house: 'Grill', asian: 'Asiatique', korean: 'Coréen',
  moroccan: 'Marocain', african: 'Africain', tapas: 'Tapas', bakery: 'Boulangerie', ice_cream: 'Glacier',
  french_tacos: 'Tacos', chicken: 'Poulet', poke: 'Poké', salad: 'Salades', bagel: 'Bagels',
  fish_and_chips: 'Fish & chips', pasta: 'Pâtes', brunch: 'Brunch', dessert: 'Desserts', nepalese: 'Népalais',
  argentinian: 'Argentin', american: 'Américain', mediterranean: 'Méditerranéen', middle_eastern: 'Oriental',
  oriental: 'Oriental', brazilian: 'Brésilien', peruvian: 'Péruvien', georgian: 'Géorgien', afghan: 'Afghan',
  indonesian: 'Indonésien', persian: 'Persan', ethiopian: 'Éthiopien', senegalese: 'Sénégalais', creole: 'Créole',
  couscous: 'Couscous', fondue: 'Fondue', raclette: 'Raclette', waffle: 'Gaufres', pancake: 'Pancakes', diner: 'Diner',
  burger_and_kebab: 'Burger', hot_dog: 'Hot-dog', noodle: 'Nouilles', ramen: 'Ramen', dumplings: 'Raviolis',
  portuguese: 'Portugais', spanish: 'Espagnol', thai_cuisine: 'Thaï', international: 'Du monde',
};

const AMENITY_FR: Record<string, string> = {
  restaurant: 'Restaurant', fast_food: 'Street & Fast', cafe: 'Café', bar: 'Bar', pub: 'Bar', ice_cream: 'Glacier',
};

const humanize = (raw: string): string => {
  const s = raw.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function cuisineLabel(rec: Pick<OsmRecord, 'c' | 'k' | 'd'>): string {
  const first = rec.c.split(/[;,]/)[0]?.trim().toLowerCase();
  if (first) return CUISINE_FR[first] ?? humanize(first);
  if (rec.d) return 'Végétarien';
  return AMENITY_FR[rec.k] ?? 'Restaurant';
}

/**
 * Une fiche OSM est « présentable » si on connaît le type de cuisine ET des horaires lisibles.
 * Les autres restent dans la base mais ne sont jamais proposées dans le deck.
 */
export function isPresentable(rec: OsmRecord): boolean {
  return Boolean(rec.c) && parseOsmHours(rec.h) !== undefined;
}

/** Plus la fiche est riche, plus elle passe tôt dans le deck. */
export function completeness(rec: OsmRecord): number {
  return (rec.w ? 2 : 0) + (rec.a ? 1 : 0) + (rec.d ? 1 : 0);
}

function describe(rec: OsmRecord, cuisine: string, quartier: string | null, distance?: string): string {
  const place = quartier ? `dans le quartier ${quartier}` : 'à Toulouse';
  const parts = [`${cuisine} ${place}${distance ? `, à ${distance} de toi` : ''}.`];
  if (rec.d) parts.push('Options végétariennes.');
  if (rec.k === 'fast_food') parts.push('Restauration rapide.');
  if (rec.w) parts.push('Menu et infos sur leur site.');
  return parts.join(' ');
}

/** Transforme un enregistrement OSM en carte Fooder. Pas de note ni de photo inventées. */
export function osmToRestaurant(rec: OsmRecord, origin?: { lat: number; lng: number }): Restaurant {
  const dist = origin ? haversine(origin.lat, origin.lng, rec.la, rec.ln) : undefined;
  const cuisine = cuisineLabel(rec);
  const quartier = quartierFor(rec.la, rec.ln);
  const distance = dist !== undefined ? formatMeters(dist) : undefined;
  return {
    id: rec.id,
    name: rec.n,
    rating: 0,
    price: 0,
    distance: distance ?? 'Toulouse',
    distanceMeters: dist !== undefined ? Math.round(dist) : undefined,
    cuisine,
    image: '',
    address: rec.a || (quartier ? `Quartier ${quartier}, Toulouse` : 'Toulouse'),
    lat: rec.la,
    lng: rec.ln,
    description: describe(rec, cuisine, quartier, distance),
    website: rec.w || undefined,
    hours: parseOsmHours(rec.h),
    dataSource: 'osm',
  };
}
