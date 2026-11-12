/**
 * Correspondance restoId -> place_id Google, stockée côté client (le place_id peut être conservé indéfiniment,
 * contrairement aux références de photo et aux octets d'image). Liste ordonnée du plus ancien au plus récent.
 */
export type PlaceIdEntry = [string, string];

export const MAX_PLACE_IDS = 3000;
export const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function findPlaceId(list: readonly PlaceIdEntry[], restoId: string): string | null {
  for (let i = list.length - 1; i >= 0; i--) if (list[i][0] === restoId) return list[i][1];
  return null;
}

/** Retourne une nouvelle liste (sans mutation) avec l'entrée rajeunie ; évince les plus anciennes au-delà de la borne. */
export function addPlaceId(list: readonly PlaceIdEntry[], restoId: string, placeId: string): PlaceIdEntry[] {
  if (!restoId || !PLACE_ID_RE.test(placeId)) return [...list];
  const next: PlaceIdEntry[] = [...list.filter(([id]) => id !== restoId), [restoId, placeId]];
  return next.length > MAX_PLACE_IDS ? next.slice(next.length - MAX_PLACE_IDS) : next;
}
