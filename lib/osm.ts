import { verifiedAddress } from './addresses';
import { isBuffet } from './buffets';
import { PROTEIN_LABEL } from './categories';
import { dishPhotoFor } from './dishes';
import type { Diet, Restaurant } from '../data/mockRestaurants';
import { formatMeters, haversine } from './geo';
import { parseOpeningHours } from './openingHours';
import { quartierFor } from './quartiers';
import { withBetterPhoto } from './photoPriority';
import { safeWebUrl } from './safeUrl';
import { restaurantPhoto } from './sitePhotos';

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
  t?: string; // téléphone
  d: 0 | 1; // végétarien
  dt?: Diet[]; // régimes déclarés (OSM)
  s?: 'o' | 'v' | 'b'; // source : OpenStreetMap, Overture, les deux
}

const CUISINE_FR: Record<string, string> = {
  pizza: 'Pizza', italian_pizza: 'Pizza', burger: 'Burger', kebab: 'Kebab', sushi: 'Japonais', japanese: 'Japonais',
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

const fold = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Étiquettes OSM qui, en tête de liste, disent « la protéine est le sujet » (poulet, crousty, rôtisserie, wings). */
const PROTEIN_TAGS = new Set(['chicken', 'crousty', 'fried_chicken', 'wings', 'chicken_wings', 'rotisserie', 'tenders']);
/** Mots du nom qui suffisent : concept protéiné, crousty, rôtisserie, poulet. « Croustille » n'en est pas un. */
const PROTEIN_STRONG = /proteine|\bprotein\b|crousty|krousty|crousti(?!ll)|rotisserie|poulet|galinette|tenders?\b|fried chicken/;
/** Mots plus faibles (« chicken », « wings ») : acceptés seulement sans autre cuisine précise. */
const PROTEIN_WEAK = /chicken|\bwings?\b/;
const WEAK_BLOCKERS = /pizz|kebab|sushi|wok|thai|nem/;
const GENERIC_TAGS = new Set(['burger', 'sandwich', 'french', 'fast_food', 'wrap', 'halal', 'salad', 'grill']);

/**
 * « Protéine d'abord » : poulet croustillant, rôtisseries, wings, concepts protéinés (Good Protein…).
 * Les tacos restent des tacos, les steakhouses et grillades restent des grills (décision produit).
 */
export function isProteinFirst(rec: Pick<OsmRecord, 'n' | 'c'>): boolean {
  const name = fold(rec.n ?? '');
  const tags = (rec.c ?? '').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  if (tags.includes('french_tacos') || /tacos/.test(name)) return false;
  if (tags.slice(0, 2).some(t => PROTEIN_TAGS.has(t))) return true;
  if (PROTEIN_STRONG.test(name)) return true;
  if (PROTEIN_WEAK.test(name) && !WEAK_BLOCKERS.test(name)) return tags.every(t => GENERIC_TAGS.has(t));
  return false;
}

export function cuisineLabel(rec: Pick<OsmRecord, 'c' | 'k' | 'd'> & { n?: string }): string {
  if (rec.n && isProteinFirst({ n: rec.n, c: rec.c })) return PROTEIN_LABEL;
  const first = rec.c.split(/[;,]/)[0]?.trim().toLowerCase();
  if (first) return CUISINE_FR[first] ?? humanize(first);
  if (rec.d) return 'Végétarien';
  return AMENITY_FR[rec.k] ?? 'Restaurant';
}

const hoursCache = new Map<string, boolean>();
const hasHours = (rec: OsmRecord): boolean => {
  if (!rec.h) return false;
  let ok = hoursCache.get(rec.id);
  if (ok === undefined) {
    ok = parseOpeningHours(rec.h) !== undefined;
    hoursCache.set(rec.id, ok);
  }
  return ok;
};

/** Richesse d'une fiche : plus elle est élevée, plus elle passe tôt dans le deck. */
export function completeness(rec: OsmRecord): number {
  return (rec.c ? 2 : 0) + (hasHours(rec) ? 3 : 0) + (rec.w ? 2 : 0) + (rec.a ? 1 : 0) + (rec.t ? 1 : 0) + (rec.d ? 1 : 0);
}

/** Restauration collective non ouverte au public (entreprise, école, administration) : pas une sortie au resto. */
const INSTITUTIONAL = /sodexo|elior|restauration scolaire|restaurant d['’]entreprise|restaurant universitaire|restaurant d['’]application|toulousaine de restauration|cantine (inrae|enfip)|^b[âa]timent \d|\blyc[ée]e\b|\bcollège\b|\bR\.?I\.?E\b/i;

/**
 * Critères d'information d'une fiche, sans la barrière d'adresse vérifiée : assez d'informations utiles
 * (cuisine, horaires, adresse, site, téléphone), score d'au moins 4. Sert aussi aux scripts de vérification des adresses.
 */
export function isPresentableBase(rec: OsmRecord): boolean {
  if (INSTITUTIONAL.test(rec.n)) return false;
  // Sans cuisine ni horaires lisibles, rien ne prouve que c'est un restaurant ouvert (éditeur de logiciel, bureau…).
  if (!rec.c && !hasHours(rec)) return false;
  return completeness(rec) >= 4;
}

/**
 * Fiche servie par l'appli : assez d'informations (voir isPresentableBase) ET une adresse vérifiée (lib/addresses.ts).
 * Mieux vaut une fiche absente qu'une fiche à l'adresse fausse ou inventée.
 */
export const isPresentable = (rec: OsmRecord): boolean => isPresentableBase(rec) && verifiedAddress(rec.id) !== null;

/** Numéro au format international (+33…), ou undefined si illisible. */
export function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+\d{9,15}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^33\d{9}$/.test(digits)) return `+${digits}`;
  return undefined;
}

function describe(rec: OsmRecord, cuisine: string, quartier: string | null, distance?: string): string {
  const place = quartier ? `dans le quartier ${quartier}` : 'à Toulouse';
  const parts = [`${cuisine === PROTEIN_LABEL ? 'Cuisine protéinée' : cuisine} ${place}${distance ? `, à ${distance} de toi` : ''}.`];
  if (rec.d) parts.push('Options végétariennes.');
  if (rec.k === 'fast_food') parts.push('Restauration rapide.');
  if (rec.w) parts.push('Menu et infos sur leur site.');
  else if (rec.t) parts.push('Réservation par téléphone.');
  return parts.join(' ');
}

/** Transforme un enregistrement OSM en carte Fooder. Pas de note ni de photo inventées. */
export function osmToRestaurant(rec: OsmRecord, origin?: { lat: number; lng: number }): Restaurant {
  const dist = origin ? haversine(origin.lat, origin.lng, rec.la, rec.ln) : undefined;
  const cuisine = cuisineLabel(rec);
  const quartier = quartierFor(rec.la, rec.ln);
  const distance = dist !== undefined ? formatMeters(dist) : undefined;
  const dish = dishPhotoFor(cuisine, rec.n, rec.id);
  const card: Restaurant = {
    id: rec.id,
    name: rec.n,
    rating: 0,
    price: 0,
    distance: distance ?? 'Toulouse',
    distanceMeters: dist !== undefined ? Math.round(dist) : undefined,
    cuisine,
    image: '',
    // Adresse vérifiée seulement : jamais l'adresse brute des sources, jamais un repli « Quartier X » présenté comme une adresse.
    address: verifiedAddress(rec.id) ?? '',
    lat: rec.la,
    lng: rec.ln,
    description: describe(rec, cuisine, quartier, distance),
    website: safeWebUrl(rec.w),
    phone: normalizePhone(rec.t),
    hours: parseOpeningHours(rec.h),
    dataSource: 'osm',
    ...(rec.dt?.length ? { diets: [...rec.dt] } : {}),
    ...(isBuffet(rec.id) ? { buffet: true } : {}),
  };
  // Priorité : voir PHOTO_PRIORITY. Photo du restaurant seulement avec son consentement (lib/sitePhotos.ts).
  const illustrated = dish ? withBetterPhoto(card, { source: 'dish', images: [dish.src], credit: dish.author, license: dish.license, page: dish.page }) : card;
  const own = restaurantPhoto(rec.id);
  return own
    ? withBetterPhoto(illustrated, { source: own.kind === 'dish' ? 'restaurant' : 'site', images: [own.src], credit: own.credit })
    : illustrated;
}
