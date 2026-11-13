/**
 * Adresses via la Base Adresse Nationale (api-adresse.data.gouv.fr) : service public gratuit, sans clé,
 * licence ouverte. Géocodage inverse (adresse de l'utilisateur) et recherche (saisie manuelle).
 * La lecture des réponses est pure et testée ; le client ajoute délai, cache mémoire et repli.
 * Ce qui part vers le service : coordonnées arrondies à 4 décimales (~10 m) pour l'inverse,
 * 2 décimales (~1 km, simple biais) pour la recherche, et le texte saisi. Rien d'autre.
 */
import { haversine } from '../geo';
import { roundCoord, type Coords } from './position';

export const BAN_BASE = 'https://api-adresse.data.gouv.fr';
export const ADDRESS_TIMEOUT_MS = 4_000;
export const ADDRESS_DEBOUNCE_MS = 300;
/** En dessous de ce déplacement, l'adresse affichée reste valable (pas de nouvelle requête). */
export const ADDRESS_MIN_MOVE_M = 30;
export const SEARCH_MIN_CHARS = 3;
export const SEARCH_MAX_RESULTS = 5;

export type AddressKind = 'housenumber' | 'street' | 'locality' | 'municipality' | 'other';

export interface Address {
  id: string;
  /** « 12 rue d'Alsace-Lorraine » */
  short: string;
  /** « 12 rue d'Alsace-Lorraine, 31000 Toulouse » */
  label: string;
  postcode?: string;
  city?: string;
  coords: Coords;
  kind: AddressKind;
}

/* ── Casse française des types de voie ────────────────────────────── */

const VOIE: Record<string, string> = {
  rue: 'rue', 'r.': 'rue', allee: 'allée', allée: 'allée', allees: 'allées', allées: 'allées', 'all.': 'allée',
  avenue: 'avenue', 'av.': 'avenue', av: 'avenue', boulevard: 'boulevard', bd: 'boulevard', 'bd.': 'boulevard', bld: 'boulevard',
  place: 'place', 'pl.': 'place', pl: 'place', impasse: 'impasse', 'imp.': 'impasse', chemin: 'chemin', 'ch.': 'chemin', che: 'chemin',
  quai: 'quai', route: 'route', rte: 'route', 'rte.': 'route', cours: 'cours', square: 'square', esplanade: 'esplanade',
  passage: 'passage', port: 'port', promenade: 'promenade', sentier: 'sentier', voie: 'voie', faubourg: 'faubourg',
  'rond-point': 'rond-point', ruelle: 'ruelle', résidence: 'résidence', residence: 'résidence', parvis: 'parvis',
};

const LEAD = /^(\d+(?:\/\d+)?(?:\s*(?:bis|ter|b))?\s+)?(\S+)(.*)$/i;

const splitLead = (text: string): RegExpMatchArray | null => text.trim().match(LEAD);

/** « 9 Pl. du Capitole » → « 9 place du Capitole » ; le reste du texte est conservé tel quel. */
export function streetCase(text: string): string {
  const m = splitLead(text);
  if (!m) return text.trim();
  const [, num = '', word, rest] = m;
  const voie = VOIE[word.toLowerCase()];
  return voie ? `${num}${voie}${rest}` : text.trim();
}

/** Vrai si le texte commence par un numéro ou un type de voie (sinon c'est une ville, un quartier…). */
export function looksLikeStreet(text: string): boolean {
  const m = splitLead(text);
  if (!m) return false;
  return Boolean(m[1]) || Boolean(VOIE[m[2].toLowerCase()]);
}

/* ── Lecture pure ─────────────────────────────────────────────────── */

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

const KINDS: readonly AddressKind[] = ['housenumber', 'street', 'locality', 'municipality'];

export function featureToAddress(feature: unknown): Address | null {
  if (!feature || typeof feature !== 'object') return null;
  const f = feature as { geometry?: { coordinates?: unknown } | null; properties?: Record<string, unknown> };
  const coords = f.geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
  const [lng, lat] = coords as number[];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const p = f.properties ?? {};
  const name = str(p.name) ?? str(p.label);
  if (!name) return null;
  const short = streetCase(name);
  const postcode = str(p.postcode);
  const city = str(p.city);
  const place = [postcode, city].filter(Boolean).join(' ');
  const type = str(p.type) as AddressKind | undefined;
  return {
    id: str(p.id) ?? `${lat},${lng}`,
    short,
    label: place && short !== city ? `${short}, ${place}` : short,
    postcode,
    city,
    coords: { lat, lng },
    kind: type && KINDS.includes(type) ? type : 'other',
  };
}

const featuresOf = (json: unknown): unknown[] => {
  const f = json && typeof json === 'object' ? (json as { features?: unknown }).features : undefined;
  return Array.isArray(f) ? f : [];
};

/** Première adresse d'une réponse /reverse, ou null. */
export function parseReverse(json: unknown): Address | null {
  for (const f of featuresOf(json)) {
    const a = featureToAddress(f);
    if (a) return a;
  }
  return null;
}

/** Suggestions d'une réponse /search : Haute-Garonne (31) d'abord, sans doublon, 5 au plus. */
export function parseSearch(json: unknown, max = SEARCH_MAX_RESULTS): Address[] {
  const seen = new Set<string>();
  const all: Address[] = [];
  for (const f of featuresOf(json)) {
    const a = featureToAddress(f);
    if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    all.push(a);
  }
  const local = all.filter(a => a.postcode?.startsWith('31'));
  const other = all.filter(a => !a.postcode?.startsWith('31'));
  return [...local, ...other].slice(0, max);
}

/* ── URL ──────────────────────────────────────────────────────────── */

export function buildReverseUrl(c: Coords): string {
  return `${BAN_BASE}/reverse/?lon=${roundCoord(c.lng, 4)}&lat=${roundCoord(c.lat, 4)}&limit=1`;
}

/** null si la saisie est trop courte. On demande 10 résultats pour remonter ceux du 31, on en garde 5. */
export function buildSearchUrl(query: string, near: Coords | null): string | null {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 200);
  if (q.length < SEARCH_MIN_CHARS) return null;
  const bias = near ? `&lat=${roundCoord(near.lat, 2)}&lon=${roundCoord(near.lng, 2)}` : '';
  return `${BAN_BASE}/search/?q=${encodeURIComponent(q)}&limit=10${bias}`;
}

export function movedEnough(prev: Coords | null, next: Coords, minM = ADDRESS_MIN_MOVE_M): boolean {
  return !prev || haversine(prev.lat, prev.lng, next.lat, next.lng) >= minM;
}

/* ── Client (délai, cache, repli) ─────────────────────────────────── */

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface AddressClient {
  reverse: (c: Coords) => Promise<Address | null>;
  search: (query: string, near: Coords | null) => Promise<Address[]>;
}

export function createAddressClient(opts: { fetch: FetchLike; timeoutMs?: number }): AddressClient {
  const timeoutMs = opts.timeoutMs ?? ADDRESS_TIMEOUT_MS;
  const reverseCache = new Map<string, Address>();
  const searchCache = new Map<string, Address[]>();
  let last: { coords: Coords; address: Address } | null = null;

  const getJson = async (url: string): Promise<unknown> => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
      const res = await opts.fetch(url, { signal: ctrl?.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async reverse(c) {
      if (last && !movedEnough(last.coords, c)) return last.address;
      const url = buildReverseUrl(c);
      const address = reverseCache.get(url) ?? parseReverse(await getJson(url));
      if (!address) return null;
      reverseCache.set(url, address);
      last = { coords: c, address };
      return address;
    },
    async search(query, near) {
      const url = buildSearchUrl(query.toLowerCase(), near);
      if (!url) return [];
      const cached = searchCache.get(url);
      if (cached) return cached;
      const json = await getJson(url);
      if (json === null) return [];
      const list = parseSearch(json);
      searchCache.set(url, list);
      return list;
    },
  };
}

let shared: AddressClient | null = null;

/** Client partagé par toute l'appli (un seul cache mémoire). */
export function addressClient(): AddressClient {
  shared ??= createAddressClient({ fetch: (url, init) => fetch(url, init) });
  return shared;
}

/** Debounce simple (300 ms par défaut), annulable au démontage. */
export function createDebouncer<A extends unknown[]>(fn: (...args: A) => void, ms = ADDRESS_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call(...args: A) {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, ms);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
