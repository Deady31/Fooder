import type { Diet, Restaurant } from '../data/mockRestaurants';
import { matchesDiets } from './diets';
import { haversine } from './geo';
import { isOpenAt } from './openingHours';

/** Régimes proposés en puces (sans gluten : trop peu de données, badge seulement). */
export const FILTER_DIETS: readonly Diet[] = ['vegetarian', 'vegan', 'halal'];

export interface FilterOptions {
  openNow: boolean;
  diets: Diet[];
  now: Date;
  /** Position de référence (vraie position, adresse saisie ou centre par défaut). */
  origin?: { lat: number; lng: number } | null;
  /** Rayon en mètres ; null ou absent = toute la métropole. */
  radiusM?: number | null;
  /** Budget max en euros ; null ou absent = sans limite. Les prix inconnus (0) passent. */
  maxPrice?: number | null;
  /** Cuisine exacte ; null ou absent = toutes. */
  cuisine?: string | null;
}

function withinRadius(r: Restaurant, origin: FilterOptions['origin'], radiusM: FilterOptions['radiusM']): boolean {
  if (!origin || radiusM === null || radiusM === undefined) return true;
  if (r.lat === undefined || r.lng === undefined) return false;
  return haversine(origin.lat, origin.lng, r.lat, r.lng) <= radiusM;
}

/**
 * Filtres non destructifs (la liste d'entrée n'est jamais modifiée, l'ordre est conservé) :
 * - « Ouvert maintenant » : ouverture certaine uniquement (horaires inconnus = exclus) ;
 * - régimes : ET logique, fiches sans info exclues ;
 * - rayon : distance à vol d'oiseau depuis `origin`, fiches sans coordonnées exclues ;
 * - budget : prix connu au-dessus du maximum exclu ; cuisine : égalité stricte.
 */
export function applyFilters(restaurants: readonly Restaurant[], opts: FilterOptions): Restaurant[] {
  const { openNow, diets, now, origin, radiusM, maxPrice, cuisine } = opts;
  return restaurants.filter(
    r =>
      (!openNow || isOpenAt(r.hours, now) === true) &&
      matchesDiets(r, diets) &&
      withinRadius(r, origin, radiusM) &&
      (maxPrice === null || maxPrice === undefined || !(r.price > 0) || r.price <= maxPrice) &&
      (!cuisine || r.cuisine === cuisine),
  );
}

export function toggleDiet(current: readonly Diet[], diet: Diet): Diet[] {
  return current.includes(diet) ? current.filter(d => d !== diet) : [...current, diet];
}

/** Lit défensivement le JSON brut de `fooder_profile` et renvoie les régimes filtrables (vegan/vegetarian/halal). */
export function dietsFromProfile(raw: string | null): Diet[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = parsed && typeof parsed === 'object' ? (parsed as { diets?: unknown }).diets : undefined;
    if (!Array.isArray(list)) return [];
    const valid = list.filter((d): d is Diet => typeof d === 'string' && FILTER_DIETS.includes(d as Diet));
    return Array.from(new Set(valid));
  } catch {
    return [];
  }
}

export type BlockingFilter = 'radius' | 'diets' | 'openNow' | 'price';

/**
 * Filtre à relâcher quand il ne reste aucune carte : le rayon s'il suffit, sinon le régime,
 * « ouvert maintenant », et enfin budget/cuisine.
 */
export function blockingFilter(restaurants: readonly Restaurant[], opts: FilterOptions): BlockingFilter {
  const passes = (o: FilterOptions) => applyFilters(restaurants, o).length > 0;
  if (opts.radiusM !== null && opts.radiusM !== undefined && passes({ ...opts, radiusM: null })) return 'radius';
  if (opts.diets.length > 0 && passes({ ...opts, diets: [] })) return 'diets';
  if (opts.openNow && passes({ ...opts, openNow: false })) return 'openNow';
  if (opts.diets.length > 0) return 'diets';
  if (opts.openNow) return 'openNow';
  return opts.maxPrice != null || opts.cuisine ? 'price' : 'radius';
}
