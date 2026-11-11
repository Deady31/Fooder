import { Restaurant } from '../data/mockRestaurants';

export interface FetchedPhoto {
  url: string;
  author: string;
  authorUri?: string;
}

const CACHE_KEY = 'fooder_gphotos';
const TTL = 20 * 60_000; // les URL de Google sont temporaires : cache de session court, jamais en stockage durable
const inflight = new Map<string, Promise<FetchedPhoto[]>>();

type CacheShape = Record<string, { at: number; photos: FetchedPhoto[] }>;

function readCache(): CacheShape {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(id: string, photos: FetchedPhoto[]): void {
  try {
    const all = readCache();
    const keep = Object.entries(all).filter(([, v]) => Date.now() - v.at < TTL).slice(-120);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...Object.fromEntries(keep), [id]: { at: Date.now(), photos } }));
  } catch {
    /* stockage de session indisponible : on se contente de la mémoire */
  }
}

/** Vraies photos Google d'un restaurant (liste vide si aucune, si le service est désactivé ou en cas d'erreur). */
export function fetchGooglePhotos(rest: Pick<Restaurant, 'id' | 'name' | 'lat' | 'lng'>): Promise<FetchedPhoto[]> {
  if (rest.lat === undefined || rest.lng === undefined) return Promise.resolve([]);
  const hit = readCache()[rest.id];
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.photos);
  const pending = inflight.get(rest.id);
  if (pending) return pending;

  const qs = new URLSearchParams({ name: rest.name, lat: String(rest.lat), lng: String(rest.lng) });
  const job = fetch(`/api/place-photos?${qs.toString()}`)
    .then(r => (r.ok ? r.json() : { data: [] }))
    .then(json => {
      const photos = Array.isArray(json.data) ? (json.data as FetchedPhoto[]).filter(p => typeof p.url === 'string' && p.url.startsWith('https://')) : [];
      writeCache(rest.id, photos);
      return photos;
    })
    .catch(() => [] as FetchedPhoto[])
    .finally(() => inflight.delete(rest.id));
  inflight.set(rest.id, job);
  return job;
}
