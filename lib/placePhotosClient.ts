import { Restaurant } from '../data/mockRestaurants';
import { readJson, writeJson } from './store';
import { PlaceIdEntry, addPlaceId, findPlaceId } from './google/placeIdCache';

export interface FetchedPhoto {
  url: string;
  author: string;
  authorUri?: string;
  googleMapsUri?: string;
}

const PLACE_IDS_KEY = 'fooder_place_ids';
const TTL = 30 * 60_000; // les URL de Google sont temporaires : mémoire de session seulement, jamais de stockage durable
const session = new Map<string, { at: number; photos: FetchedPhoto[] }>();
const inflight = new Map<string, Promise<FetchedPhoto[]>>();

function rememberPlaceId(restoId: string, placeId: unknown): void {
  if (typeof placeId !== 'string') return;
  const list = readJson<PlaceIdEntry[]>(PLACE_IDS_KEY, []);
  const safe = Array.isArray(list) ? list : [];
  if (findPlaceId(safe, restoId) === placeId) return;
  writeJson(PLACE_IDS_KEY, addPlaceId(safe, restoId, placeId));
}

/**
 * Vraie photo Google d'un restaurant (liste de 0 ou 1 élément ; vide si aucune, service désactivé, plafond atteint ou erreur).
 * À n'appeler que pour les cartes du dessus : chaque photo affichée est un appel facturé côté serveur.
 */
export function fetchGooglePhotos(rest: Pick<Restaurant, 'id' | 'name' | 'lat' | 'lng'>): Promise<FetchedPhoto[]> {
  if (rest.lat === undefined || rest.lng === undefined) return Promise.resolve([]);
  const hit = session.get(rest.id);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.photos);
  const pending = inflight.get(rest.id);
  if (pending) return pending;

  const qs = new URLSearchParams({ name: rest.name, lat: String(rest.lat), lng: String(rest.lng) });
  const known = findPlaceId(readJson<PlaceIdEntry[]>(PLACE_IDS_KEY, []), rest.id);
  if (known) qs.set('placeId', known);

  const job = fetch(`/api/place-photos?${qs.toString()}`)
    .then(r => (r.ok ? r.json() : null))
    .then(json => {
      if (!json) return [] as FetchedPhoto[]; // erreur ou limite : on ne mémorise pas, une prochaine visite pourra réessayer
      rememberPlaceId(rest.id, json.placeId);
      const photos = Array.isArray(json.data)
        ? (json.data as FetchedPhoto[]).filter(p => typeof p.url === 'string' && p.url.startsWith('https://')).slice(0, 1)
        : [];
      session.set(rest.id, { at: Date.now(), photos });
      return photos;
    })
    .catch(() => [] as FetchedPhoto[])
    .finally(() => inflight.delete(rest.id));
  inflight.set(rest.id, job);
  return job;
}
