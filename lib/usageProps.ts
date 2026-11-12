/**
 * Construction des propriétés des mesures d'usage à partir de données de l'appli.
 * Fonctions pures : jamais de nom de resto ni de texte libre, uniquement des mots-clés génériques et des nombres bornés.
 */

const MAX_SLUG = 24;
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;

/** « Thaï » → « thai », « Du monde » → « du-monde ». Valeur inconnue ou vide : « autre ». */
export function cuisineSlug(label: unknown): string {
  if (typeof label !== 'string') return 'autre';
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');
  return SLUG_RE.test(slug) ? slug : 'autre';
}

/** Distance entière en km (0 si inconnue), bornée à 100. */
export function distanceKm(meters: unknown): number {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return 0;
  return Math.min(100, Math.round(meters / 1000));
}

interface SwipeLike {
  cuisine: string;
  distanceMeters?: number;
}

export function swipeProps(r: SwipeLike): { cuisine: string; distance_km: number } {
  return { cuisine: cuisineSlug(r.cuisine), distance_km: distanceKm(r.distanceMeters) };
}

export function openCardProps(r: Pick<SwipeLike, 'cuisine'>, from: 'swipe' | 'list' | 'share'): { cuisine: string; from: string } {
  return { cuisine: cuisineSlug(r.cuisine), from };
}

export function verdictSlug(v: unknown): string {
  return v === 'miam' || v === 'bof' ? v : 'autre';
}
