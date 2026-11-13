/** Rayon de recherche choisi par l'utilisateur (null = toute la métropole). */
export type Radius = number | null;

export const RADIUS_KEY = 'fooder_radius';
export const RADIUS_STEPS: readonly Radius[] = [500, 1000, 2000, 5000, 10000, null];
export const DEFAULT_RADIUS_M = 2000;

export function parseRadius(value: unknown): Radius {
  if (value === 'metro') return null;
  return typeof value === 'number' && RADIUS_STEPS.includes(value) ? value : DEFAULT_RADIUS_M;
}

export function serializeRadius(r: Radius): number | 'metro' {
  return r ?? 'metro';
}

export function radiusLabel(r: Radius): string {
  if (r === null) return 'Toute la métropole';
  return r < 1000 ? `${r} m` : `${r / 1000} km`;
}

/** Libellé court pour la puce d'en-tête. */
export function radiusShortLabel(r: Radius): string {
  return r === null ? 'Métropole' : radiusLabel(r);
}

/** « à moins de 2 km » / « dans la métropole ». */
export function withinLabel(r: Radius): string {
  return r === null ? 'dans la métropole' : `à moins de ${radiusLabel(r)}`;
}

/**
 * Prochain palier plus large qui apporte des résultats en plus de l'actuel.
 * undefined : aucun palier ne fait mieux (ou déjà « toute la métropole »).
 */
export function nextRadiusWithResults(current: Radius, count: (r: Radius) => number): Radius | undefined {
  if (current === null) return undefined;
  const base = count(current);
  const larger = RADIUS_STEPS.filter(r => r === null || r > current);
  return larger.find(r => count(r) > base);
}
