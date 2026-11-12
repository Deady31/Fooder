import type { Diet, Restaurant } from '../data/mockRestaurants';
import { matchesDiets } from './diets';
import { isOpenAt } from './openingHours';

/** Régimes proposés en puces (sans gluten : trop peu de données, badge seulement). */
export const FILTER_DIETS: readonly Diet[] = ['vegetarian', 'vegan', 'halal'];

export interface FilterOptions {
  openNow: boolean;
  diets: Diet[];
  now: Date;
}

/**
 * « Ouvert maintenant » : ouverture certaine uniquement (horaires inconnus = exclus).
 * Régimes : ET logique, fiches sans info exclues. Ordre conservé, liste d'entrée intacte.
 */
export function applyFilters(restaurants: readonly Restaurant[], { openNow, diets, now }: FilterOptions): Restaurant[] {
  return restaurants.filter(
    r => (!openNow || isOpenAt(r.hours, now) === true) && matchesDiets(r, diets),
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
