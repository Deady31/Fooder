import { haversine } from '../geo';
import { PLACE_ID_RE } from './placeIdCache';

/**
 * Photo d'un restaurant via l'API officielle Google Places (New), appelée côté serveur uniquement.
 * Séquence la moins chère : Text Search (IDs only) -> Place Details (photos, IDs only) -> média (seul appel facturé).
 * Rien n'est stocké côté serveur (ni octets, ni référence de photo). La clé ne quitte jamais le serveur.
 */

export interface PlacePhoto {
  url: string;
  author: string;
  authorUri?: string;
  googleMapsUri?: string;
}

const API = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 6000;
/** Même établissement : le nom ET une position à moins de 150 m. Au-delà, ce n'est pas lui (ou on n'en est pas sûr). */
const MAX_DISTANCE_M = 150;
/** Deux candidats valides : on ne garde le plus proche que s'il est quasi sur place et nettement plus proche que l'autre. */
const AMBIGUITY_BEST_M = 40;
const AMBIGUITY_GAP_M = 80;
const MEDIA_WIDTH_PX = 800;
const M_PER_DEG = 111_320;

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

export interface PhotoQuery {
  name: string;
  lat: number;
  lng: number;
}

export interface SearchCandidate {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
}

/**
 * Identifie l'établissement EXACT. Un candidat n'est retenu que si son nom correspond ET que sa position est à
 * moins de 150 m ; un candidat sans nom ou sans position est refusé (jamais « identifiant seul »).
 * Plusieurs candidats valides : ambigu, donc aucune photo, sauf si l'un est quasi sur place et nettement plus proche.
 */
export function pickBestMatch(candidates: readonly SearchCandidate[] | undefined, ours: PhotoQuery): string | null {
  const valid: { id: string; dist: number }[] = [];
  for (const c of candidates ?? []) {
    if (!c.id || !PLACE_ID_RE.test(c.id)) continue;
    const lat = c.location?.latitude;
    const lng = c.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!sameVenue(ours.name, c.displayName?.text ?? '')) continue;
    const dist = haversine(ours.lat, ours.lng, lat, lng);
    if (dist > MAX_DISTANCE_M) continue;
    valid.push({ id: c.id, dist });
  }
  if (valid.length === 0) return null;
  valid.sort((x, y) => x.dist - y.dist);
  if (valid.length === 1) return valid[0].id;
  const [best, second] = valid;
  return best.dist <= AMBIGUITY_BEST_M && second.dist - best.dist >= AMBIGUITY_GAP_M ? best.id : null;
}

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Text Search avec nom + position (obligatoires : sans eux l'établissement ne peut pas être identifié), zone ±150 m, 5 candidats. */
export function buildSearchRequest(q: PhotoQuery): BuiltRequest {
  const dLat = MAX_DISTANCE_M / M_PER_DEG;
  const dLng = MAX_DISTANCE_M / (M_PER_DEG * Math.cos((q.lat * Math.PI) / 180));
  return {
    url: `${API}/places:searchText`,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: {
      textQuery: `${q.name} Toulouse`,
      languageCode: 'fr',
      maxResultCount: 5,
      locationRestriction: {
        rectangle: {
          low: { latitude: q.lat - dLat, longitude: q.lng - dLng },
          high: { latitude: q.lat + dLat, longitude: q.lng + dLng },
        },
      },
    },
  };
}

/** Place Details avec uniquement le champ `photos` (IDs Only). */
export function buildDetailsRequest(placeId: string): BuiltRequest {
  return { url: `${API}/places/${placeId}`, headers: { 'X-Goog-FieldMask': 'photos' } };
}

/** Média : seul appel facturé. URL temporaire demandée en JSON (pas de redirection). */
export function buildMediaUrl(photoName: string): string {
  return `${API}/${photoName}/media?maxWidthPx=${MEDIA_WIDTH_PX}&skipHttpRedirect=true`;
}

export interface DetailsResponse {
  photos?: {
    name?: string;
    googleMapsUri?: string;
    authorAttributions?: { displayName?: string; uri?: string }[];
  }[];
}

export interface PhotoRef {
  name: string;
  author: string;
  authorUri?: string;
  googleMapsUri?: string;
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

/** Première référence de photo valide, avec l'attribution obligatoire (auteur + lien Google Maps). */
export function pickPhoto(d: DetailsResponse): PhotoRef | null {
  for (const p of d.photos ?? []) {
    if (!p.name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name)) continue;
    const a = p.authorAttributions?.[0];
    return {
      name: p.name,
      author: (a?.displayName ?? 'Google Maps').slice(0, 60),
      authorUri: safeUri(a?.uri),
      googleMapsUri: safeUri(p.googleMapsUri),
    };
  }
  return null;
}

async function call<T>(url: string, key: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, headers: { 'X-Goog-Api-Key': key, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type PhotoOutcome =
  | { status: 'ok'; placeId: string; photo: PlacePhoto }
  | { status: 'none'; placeId?: string }
  | { status: 'budget'; placeId: string };

export interface FetchOptions {
  /** Identifiant déjà validé pour CET établissement (jamais celui d'une recherche non vérifiée). */
  placeId?: string;
  /** Appelé juste avant l'unique appel payant ; false = plafond atteint. */
  allowPaidCall: () => boolean;
}

/** Séquence complète ; les deux premières étapes sont gratuites, seul le média passe par `allowPaidCall`. */
export async function fetchPlacePhoto(q: PhotoQuery, key: string, opts: FetchOptions): Promise<PhotoOutcome> {
  let placeId = opts.placeId && PLACE_ID_RE.test(opts.placeId) ? opts.placeId : undefined;
  let ref: PhotoRef | null = null;

  if (placeId) {
    const d = buildDetailsRequest(placeId);
    const details = await call<DetailsResponse>(d.url, key, { headers: d.headers });
    ref = details ? pickPhoto(details) : null;
    if (!details) placeId = undefined; // identifiant périmé ou invalide : on repasse par la recherche
  }

  if (!placeId) {
    const s = buildSearchRequest(q);
    const search = await call<{ places?: SearchCandidate[] }>(s.url, key, { method: 'POST', headers: s.headers, body: JSON.stringify(s.body) });
    const id = pickBestMatch(search?.places, q);
    if (!id) return { status: 'none' };
    placeId = id;
    const d = buildDetailsRequest(id);
    const details = await call<DetailsResponse>(d.url, key, { headers: d.headers });
    ref = details ? pickPhoto(details) : null;
  }

  if (!ref) return { status: 'none', placeId };
  if (!opts.allowPaidCall()) return { status: 'budget', placeId };

  const media = await call<{ photoUri?: string }>(buildMediaUrl(ref.name), key);
  const uri = media?.photoUri;
  if (!uri || !uri.startsWith('https://')) return { status: 'none', placeId };
  return { status: 'ok', placeId, photo: { url: uri, author: ref.author, authorUri: ref.authorUri, googleMapsUri: ref.googleMapsUri } };
}
