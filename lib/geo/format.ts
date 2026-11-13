import type { Restaurant } from '../../data/mockRestaurants';
import { formatMeters } from '../geo';
import { looksLikeStreet, streetCase } from './address';
import type { PositionSource } from './position';

type HasAddress = Pick<Restaurant, 'address'> & Partial<Pick<Restaurant, 'lat' | 'lng'>>;

const segments = (address: string | undefined): string[] =>
  (address ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** « 13 rue Léon Gambetta » si l'adresse OSM existe ; null pour les replis (« Quartier X, Toulouse », « Toulouse »). */
export function restaurantStreet(rest: HasAddress): string | null {
  const first = segments(rest.address)[0];
  if (!first || /^quartier\s/i.test(first) || !looksLikeStreet(first)) return null;
  return streetCase(first);
}

/** Adresse complète lisible : « 9 place du Capitole, 31000 Toulouse ». */
export function restaurantFullAddress(rest: HasAddress): string {
  const parts = segments(rest.address);
  if (parts.length === 0) return 'Toulouse';
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = i === 0 ? streetCase(parts[i]) : parts[i];
    const next = parts[i + 1];
    if (/^\d{5}$/.test(p) && next && !/\d/.test(next)) {
      out.push(`${p} ${next}`);
      i++;
    } else out.push(p);
  }
  return out.join(', ');
}

/** Distance affichée ; depuis le centre par défaut, elle est marquée comme telle (pas « de toi »). */
export function distanceLabel(meters: number, source: PositionSource): string {
  return source === 'default' ? `~${formatMeters(meters)} du centre` : formatMeters(meters);
}

/** Ligne de lieu de la carte : rue et numéro, sinon le repli (« Quartier Carmes », « Toulouse »). */
export function restaurantPlaceLine(rest: HasAddress): string {
  return restaurantStreet(rest) ?? segments(rest.address)[0] ?? 'Toulouse';
}

const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** Fiche Google Maps (simple lien de recherche, aucun appel d'API payant), avec le place_id s'il est connu. */
export function googleMapsInfoUrl(rest: Pick<Restaurant, 'name' | 'address'>, placeId?: string | null): string {
  const query = encodeURIComponent(`${rest.name} ${restaurantFullAddress(rest)}`.trim());
  const id = placeId && PLACE_ID.test(placeId) ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${query}${id}`;
}

/** Itinéraire à pied vers le resto (coordonnées), ou recherche par nom et adresse. */
export function googleMapsDirectionsUrl(rest: Pick<Restaurant, 'name' | 'address' | 'lat' | 'lng'>): string {
  if (rest.lat !== undefined && rest.lng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&destination=${rest.lat},${rest.lng}&travelmode=walking`;
  }
  return googleMapsInfoUrl(rest);
}
