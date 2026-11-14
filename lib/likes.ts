import type { Restaurant } from '../data/mockRestaurants';
import { haversine } from './geo';
import { STORE_EVENT, readJson, writeJson } from './store';
import { CHECKINS_KEY, Checkin, queueCheckin, readCheckins } from './visits';

/**
 * Source unique des coups de cœur (et des écartés) : lecture, écriture et événements.
 * Favoris, Carte, Profil et la barre d'onglets passent tous par ici, donc comptent la même chose.
 * Chaque écriture émet STORE_EVENT (via lib/store) : `subscribeLikes` permet de se rafraîchir sans navigation.
 */
export const LIKES_KEY = 'fooder_likes';
export const WISHLIST_KEY = 'fooder_wishlist';
export const DISLIKES_KEY = 'fooder_dislikes';

/** Un favori : le restaurant + la date du like (absente des anciens likes). */
export type SavedRestaurant = Restaurant & { likedAt?: number };

export interface Removal {
  rest: SavedRestaurant;
  index: number;
}

/** Liste valide : tableau d'objets avec un id, sans doublon (le premier gagne). */
function clean(raw: unknown): SavedRestaurant[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedRestaurant[] = [];
  for (const item of raw) {
    const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    seen.add(id);
    out.push(item as SavedRestaurant);
  }
  return out;
}

function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function readLikes(): SavedRestaurant[] {
  // L'ancienne clé « wishlist » ne sert de secours que si les likes n'ont jamais été écrits.
  const key = hasKey(LIKES_KEY) ? LIKES_KEY : WISHLIST_KEY;
  return clean(readJson<unknown>(key, []));
}

export function readDislikes(): Restaurant[] {
  return clean(readJson<unknown>(DISLIKES_KEY, []));
}

export const likesCount = (): number => readLikes().length;
export const likedIds = (): Set<string> => new Set(readLikes().map(r => r.id));

function writeLikes(list: SavedRestaurant[]): void {
  writeJson(LIKES_KEY, list);
  writeJson(WISHLIST_KEY, list);
}

/** Ajoute le resto (avec la date du like) s'il n'est pas liké, le retire sinon. Retourne le nouvel état (true = liké). */
export function toggleLike(rest: Restaurant, now: number = Date.now()): boolean {
  const likes = readLikes();
  const isLiked = likes.some(r => r.id === rest.id);
  writeLikes(isLiked ? likes.filter(r => r.id !== rest.id) : [...likes, { ...rest, likedAt: now }]);
  return !isLiked;
}

/** Retire la question « Tu y es allé ? » encore en attente (un resto retiré ne doit plus la déclencher). */
function removePendingCheckin(restId: string): void {
  const list = readCheckins();
  const next = list.filter((c: Checkin) => !(c.restId === restId && c.status === 'pending'));
  if (next.length !== list.length) writeJson(CHECKINS_KEY, next);
}

/** Retire un favori. Retourne de quoi l'annuler, ou null si l'id est inconnu. */
export function removeLike(id: string): Removal | null {
  const likes = readLikes();
  const index = likes.findIndex(r => r.id === id);
  if (index < 0) return null;
  writeLikes(likes.filter(r => r.id !== id));
  removePendingCheckin(id);
  return { rest: likes[index], index };
}

function insertAt<T extends Restaurant>(list: T[], rest: T, index: number): T[] {
  if (list.some(r => r.id === rest.id)) return list;
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), list.length) : list.length;
  return [...list.slice(0, at), rest, ...list.slice(at)];
}

/** Annule un retrait : remet le favori à sa place et reprogramme la question de visite. */
export function restoreLike(rest: SavedRestaurant, index: number): void {
  const likes = readLikes();
  const next = insertAt(likes, rest, index);
  if (next === likes) return;
  writeLikes(next);
  queueCheckin(rest);
}

export function removeDislike(id: string): Removal | null {
  const list = readDislikes();
  const index = list.findIndex(r => r.id === id);
  if (index < 0) return null;
  writeJson(DISLIKES_KEY, list.filter(r => r.id !== id));
  return { rest: list[index], index };
}

export function restoreDislike(rest: Restaurant, index: number): void {
  const list = readDislikes();
  const next = insertAt(list, rest, index);
  if (next !== list) writeJson(DISLIKES_KEY, next);
}

/* ── Tri des favoris (pur) ─────────────────────────────────────────── */

export type LikeSort = 'recent' | 'ancien' | 'az' | 'proche';
export const LIKE_SORTS: { id: LikeSort; label: string }[] = [
  { id: 'recent', label: 'Récents' },
  { id: 'ancien', label: 'Anciens' },
  { id: 'az', label: 'A→Z' },
  { id: 'proche', label: 'Les plus proches' },
];
export const LIKE_SORT_KEY = 'fooder_likes_sort';

export function parseLikeSort(raw: unknown): LikeSort {
  return LIKE_SORTS.some(s => s.id === raw) ? (raw as LikeSort) : 'recent';
}
export const readLikeSort = (): LikeSort => parseLikeSort(readJson<unknown>(LIKE_SORT_KEY, null));
export const writeLikeSort = (sort: LikeSort): boolean => writeJson(LIKE_SORT_KEY, sort);

const dateOf = (r: SavedRestaurant): number | null => (typeof r.likedAt === 'number' && Number.isFinite(r.likedAt) ? r.likedAt : null);
const foldName = (s: unknown): string => (typeof s === 'string' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() : '');

/**
 * Trie sans muter. Les likes sans date comptent comme les plus anciens ; à égalité l'ordre actuel est conservé.
 * « proche » sans position (ou sans coordonnées valides pour un resto : placé en dernier) retombe sur « recent ».
 */
export function sortLikes(list: readonly SavedRestaurant[], sort: LikeSort, from: { lat: number; lng: number } | null): SavedRestaurant[] {
  if (!Array.isArray(list)) return [];
  const indexed = list.map((r, i) => ({ r, i }));
  const stable = (cmp: (a: SavedRestaurant, b: SavedRestaurant) => number) =>
    indexed.sort((x, y) => cmp(x.r, y.r) || x.i - y.i).map(x => x.r);
  const time = (r: SavedRestaurant): number => dateOf(r) ?? Number.NEGATIVE_INFINITY;
  const byRecent = (a: SavedRestaurant, b: SavedRestaurant): number => {
    const [ta, tb] = [time(a), time(b)];
    return ta === tb ? 0 : tb > ta ? 1 : -1;
  };
  switch (sort) {
    case 'ancien':
      return stable((a, b) => byRecent(b, a));
    case 'az':
      return stable((a, b) => foldName(a.name).localeCompare(foldName(b.name), 'fr'));
    case 'proche': {
      if (!from) return stable(byRecent);
      const dist = (r: SavedRestaurant): number =>
        Number.isFinite(r.lat) && Number.isFinite(r.lng) ? haversine(from.lat, from.lng, r.lat, r.lng) : Number.POSITIVE_INFINITY;
      return stable((a, b) => {
        const [da, db] = [dist(a), dist(b)];
        return da === db ? 0 : da < db ? -1 : 1;
      });
    }
    default:
      return stable(byRecent);
  }
}

const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/** « ajouté le 12 nov » (l'année est précisée si ce n'est pas l'année en cours) ; null pour un ancien like sans date. */
export function addedLabel(likedAt: unknown, now: number = Date.now()): string | null {
  if (typeof likedAt !== 'number' || !Number.isFinite(likedAt)) return null;
  const d = new Date(likedAt);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDate() === 1 ? '1er' : String(d.getDate());
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `ajouté le ${day} ${MONTHS[d.getMonth()]}${year}`;
}

const WATCHED = new Set([LIKES_KEY, WISHLIST_KEY, DISLIKES_KEY]);

/** Appelle `cb` à chaque changement des likes ou des écartés (cet onglet ou un autre). Retourne le désabonnement. */
export function subscribeLikes(cb: () => void): () => void {
  const onStore = (e: Event) => {
    const key = (e as CustomEvent<string>).detail;
    if (typeof key === 'string' && WATCHED.has(key)) cb();
  };
  const onStorage = (e: Event) => {
    const key = (e as StorageEvent).key;
    if (key === null || WATCHED.has(key)) cb();
  };
  window.addEventListener(STORE_EVENT, onStore);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(STORE_EVENT, onStore);
    window.removeEventListener('storage', onStorage);
  };
}
