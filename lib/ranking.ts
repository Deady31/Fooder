import type { Restaurant } from '../data/mockRestaurants';

const GENERIC_CUISINES = new Set(['restaurant', 'français', 'francais', 'street & fast', 'du monde', '']);

/** Score en dessous duquel une fiche est considérée comme pauvre (poussée en fin de deck). */
export const POOR_BELOW = 4;

const hasHours = (r: Restaurant): boolean => !!r.hours && r.hours.some(day => day.length > 0);

const isPreciseCuisine = (cuisine: string | undefined): boolean => !GENERIC_CUISINES.has((cuisine ?? '').trim().toLowerCase());

/** Vraie adresse = contient un numéro ; « Toulouse » ou « Quartier X, Toulouse » sont des replis. */
const hasRealAddress = (address: string | undefined): boolean => !!address && /\d/.test(address);

function photoScore(r: Restaurant): number {
  if (!r.image) return 0;
  return r.photoSource === 'dish' ? 1 : 2;
}

/** Richesse d'une fiche : horaires (3), cuisine précise (2), site (2), photo (1 plat typique, 2 vraie), adresse (1). */
export function richness(r: Restaurant): number {
  return (
    (hasHours(r) ? 3 : 0) +
    (isPreciseCuisine(r.cuisine) ? 2 : 0) +
    (r.website ? 2 : 0) +
    photoScore(r) +
    (hasRealAddress(r.address) ? 1 : 0)
  );
}

/** Tri stable en deux groupes : fiches riches d'abord, pauvres à la fin. Rien n'est supprimé, l'ordre relatif est conservé. */
export function rankRichFirst<T extends Restaurant>(list: readonly T[]): T[] {
  const rich: T[] = [];
  const poor: T[] = [];
  for (const r of list) (richness(r) >= POOR_BELOW ? rich : poor).push(r);
  return [...rich, ...poor];
}
