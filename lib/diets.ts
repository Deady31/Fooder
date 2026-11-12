import type { Diet, Restaurant } from '../data/mockRestaurants';

export const DIETS: readonly Diet[] = ['vegan', 'vegetarian', 'halal', 'gluten_free'];

export const DIET_LABEL: Record<Diet, string> = {
  vegan: 'Vegan',
  vegetarian: 'Végétarien',
  halal: 'Halal',
  gluten_free: 'Sans gluten',
};

/** Libellés courts pour les badges de carte. */
export const DIET_SHORT_LABEL: Record<Diet, string> = {
  vegan: 'Vegan',
  vegetarian: 'Végé',
  halal: 'Halal',
  gluten_free: 'Sans gluten',
};

/** Badges affichés sur la carte : vegan implique végétarien, on n'affiche que le plus précis. */
export function badgeDiets(rest: Pick<Restaurant, 'diets'>): Diet[] {
  const have = rest.diets ?? [];
  return DIETS.filter(d => have.includes(d) && !(d === 'vegetarian' && have.includes('vegan')));
}

export const DIET_SOURCE_NOTE = 'selon OpenStreetMap';

/** Vrai si le restaurant déclare tous les régimes demandés (liste vide = tout passe). */
export function matchesDiets(rest: Pick<Restaurant, 'diets'>, wanted: Diet[]): boolean {
  if (!wanted.length) return true;
  const have = rest.diets ?? [];
  return wanted.every(d => have.includes(d));
}
