import type { Restaurant } from '../../data/mockRestaurants';
import { haversine } from '../../lib/geo';

/** Logique pure de la carte : fusion des sources, filtre, GeoJSON. Aucune dépendance au DOM ni à MapLibre. */
export type Scope = 'all' | 'liked';
export interface LatLng { lat: number; lng: number }

/** Plafond de fiches gardées en mémoire sur la carte (les coups de cœur passent toujours). */
export const MAX_PLACES = 400;
/** Déplacement (m) à partir duquel on propose « Chercher ici ». */
export const SEARCH_MOVE_METERS = 600;
export const SEARCH_RADIUS = 2000;
export const SEARCH_LIMIT = 50;

const validCoords = (r: Restaurant): r is Restaurant & LatLng =>
  typeof r.lat === 'number' && typeof r.lng === 'number' &&
  Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180;

/** Coups de cœur d'abord (leur fiche prime), puis fiches de l'API, sans doublon, avec coordonnées valides. */
export function mergePlaces(liked: Restaurant[], fetched: Restaurant[], max: number = MAX_PLACES): Restaurant[] {
  const seen = new Set<string>();
  const out: Restaurant[] = [];
  for (const rest of [...liked, ...fetched]) {
    if (!validCoords(rest) || seen.has(rest.id)) continue;
    seen.add(rest.id);
    out.push(rest);
  }
  const likedCount = out.filter(p => liked.some(l => l.id === p.id)).length;
  return out.slice(0, Math.max(max, likedCount));
}

export function scopePlaces(places: Restaurant[], scope: Scope, likedIds: Set<string>): Restaurant[] {
  return scope === 'liked' ? places.filter(p => likedIds.has(p.id)) : places;
}

export interface PlaceFeature {
  type: 'Feature';
  properties: { id: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}
export interface PlaceCollection { type: 'FeatureCollection'; features: PlaceFeature[] }

export function toFeatureCollection(places: Restaurant[]): PlaceCollection {
  return {
    type: 'FeatureCollection',
    features: places.filter(validCoords).map(p => ({
      type: 'Feature' as const,
      properties: { id: p.id },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
    })),
  };
}

export function hasMovedFar(from: LatLng | null, to: LatLng, meters: number = SEARCH_MOVE_METERS): boolean {
  return !from || haversine(from.lat, from.lng, to.lat, to.lng) > meters;
}

export function nearbyUrl(at: LatLng, radius: number = SEARCH_RADIUS, limit: number = SEARCH_LIMIT): string {
  const q = new URLSearchParams({
    lat: String(Number(at.lat.toFixed(5))),
    lng: String(Number(at.lng.toFixed(5))),
    radius: String(radius),
    limit: String(limit),
  });
  return `/api/restaurants?${q.toString()}`;
}
