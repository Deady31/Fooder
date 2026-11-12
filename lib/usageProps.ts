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
  id?: string;
  cuisine: string;
  distanceMeters?: number;
}

const REST_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

/** Identifiant du resto (pour le top restos du backoffice), seulement s'il est bien formé. Jamais le nom. */
function restIdProp(id: unknown): { rest_id?: string } {
  return typeof id === 'string' && REST_ID_RE.test(id) ? { rest_id: id } : {};
}

export function swipeProps(r: SwipeLike): { cuisine: string; distance_km: number; rest_id?: string } {
  return { cuisine: cuisineSlug(r.cuisine), distance_km: distanceKm(r.distanceMeters), ...restIdProp(r.id) };
}

export function openCardProps(r: Pick<SwipeLike, 'cuisine' | 'id'>, from: 'swipe' | 'list' | 'share'): { cuisine: string; from: string; rest_id?: string } {
  return { cuisine: cuisineSlug(r.cuisine), from, ...restIdProp(r.id) };
}

export function verdictSlug(v: unknown): string {
  return v === 'miam' || v === 'bof' ? v : 'autre';
}
