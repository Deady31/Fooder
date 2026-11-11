import { haversine } from '../geo';

/**
 * Vraies photos d'un restaurant via l'API officielle Google Places (New), appelée côté serveur uniquement.
 * Règles de Google respectées : rien n'est copié ni stocké (on n'affiche que l'URL temporaire renvoyée),
 * l'auteur de chaque photo est affiché, la clé ne quitte jamais le serveur.
 */

export interface PlacePhoto {
  url: string;
  author: string;
  authorUri?: string;
}

const API = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 6000;
const MAX_PHOTOS = 3;
const MAX_DISTANCE_M = 250;

const fold = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['le', 'la', 'les', 'l', 'chez', 'restaurant', 'resto', 'de', 'du', 'des', 'et', 'au', 'aux', 'a', 'the', 'bar', 'cafe', 'brasserie']);

const tokens = (name: string): string[] =>
  fold(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w));

/** Vrai si les deux noms désignent vraisemblablement le même lieu (évite d'afficher la photo d'un voisin). */
export function sameVenue(ours: string, theirs: string): boolean {
  const a = tokens(ours);
  const b = tokens(theirs);
  if (a.length === 0 || b.length === 0) return false;
  const joinedA = a.join('');
  const joinedB = b.join('');
  if (joinedA === joinedB) return true;
  if (Math.min(joinedA.length, joinedB.length) >= 4 && (joinedA.includes(joinedB) || joinedB.includes(joinedA))) return true;
  const setB = new Set(b);
  const common = a.filter(w => setB.has(w)).length;
  return common / Math.max(a.length, b.length) >= 0.5;
}

export interface DetailsResponse {
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  photos?: { name?: string; authorAttributions?: { displayName?: string; uri?: string }[] }[];
}

/** Valide la fiche Google (même nom, même endroit) et retourne les références de photos à afficher. */
export function acceptDetails(d: DetailsResponse, ours: { name: string; lat: number; lng: number }): { name: string; author: string; authorUri?: string }[] {
  const theirName = d.displayName?.text ?? '';
  const lat = d.location?.latitude;
  const lng = d.location?.longitude;
  if (!sameVenue(ours.name, theirName)) return [];
  if (typeof lat !== 'number' || typeof lng !== 'number' || haversine(ours.lat, ours.lng, lat, lng) > MAX_DISTANCE_M) return [];
  const out: { name: string; author: string; authorUri?: string }[] = [];
  for (const p of d.photos ?? []) {
    if (!p.name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name)) continue;
    const a = p.authorAttributions?.[0];
    out.push({ name: p.name, author: (a?.displayName ?? 'Google Maps').slice(0, 60), authorUri: safeUri(a?.uri) });
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

function safeUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' && /(^|\.)google\.[a-z.]+$/.test(u.hostname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function call<T>(url: string, key: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, headers: { 'X-Goog-Api-Key': key, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface PhotoQuery {
  name: string;
  lat: number;
  lng: number;
}

/** Recherche le lieu, vérifie qu'il s'agit du bon, puis résout les URL temporaires des photos. */
export async function fetchPlacePhotos(q: PhotoQuery, key: string): Promise<PlacePhoto[]> {
  // 1. Identifiant du lieu (champ « id » seul : requête gratuite)
  const search = await call<{ places?: { id?: string }[] }>(`${API}/places:searchText`, key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({
      textQuery: `${q.name} Toulouse`,
      languageCode: 'fr',
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: q.lat, longitude: q.lng }, radius: 150 } },
    }),
  });
  const id = search?.places?.[0]?.id;
  if (!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) return [];

  // 2. Détails minimaux : nom + position pour vérifier, photos pour afficher
  const details = await call<DetailsResponse>(`${API}/places/${id}?languageCode=fr`, key, {
    headers: { 'X-Goog-FieldMask': 'displayName,location,photos' },
  });
  if (!details) return [];
  const refs = acceptDetails(details, q);
  if (refs.length === 0) return [];

  // 3. URL temporaire de chaque photo
  const urls = await Promise.all(
    refs.map(r => call<{ photoUri?: string }>(`${API}/${r.name}/media?maxWidthPx=900&skipHttpRedirect=true`, key))
  );
  const photos: PlacePhoto[] = [];
  refs.forEach((r, i) => {
    const uri = urls[i]?.photoUri;
    if (uri && uri.startsWith('https://')) photos.push({ url: uri, author: r.author, authorUri: r.authorUri });
  });
  return photos;
}
