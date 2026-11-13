import type { Restaurant } from '../data/mockRestaurants';
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

export interface Removal {
  rest: Restaurant;
  index: number;
}

/** Liste valide : tableau d'objets avec un id, sans doublon (le premier gagne). */
function clean(raw: unknown): Restaurant[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Restaurant[] = [];
  for (const item of raw) {
    const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    seen.add(id);
    out.push(item as Restaurant);
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

export function readLikes(): Restaurant[] {
  // L'ancienne clé « wishlist » ne sert de secours que si les likes n'ont jamais été écrits.
  const key = hasKey(LIKES_KEY) ? LIKES_KEY : WISHLIST_KEY;
  return clean(readJson<unknown>(key, []));
}

export function readDislikes(): Restaurant[] {
  return clean(readJson<unknown>(DISLIKES_KEY, []));
}

export const likesCount = (): number => readLikes().length;
export const likedIds = (): Set<string> => new Set(readLikes().map(r => r.id));

function writeLikes(list: Restaurant[]): void {
  writeJson(LIKES_KEY, list);
  writeJson(WISHLIST_KEY, list);
}

/** Ajoute le resto s'il n'est pas liké, le retire sinon. Retourne le nouvel état (true = liké). */
export function toggleLike(rest: Restaurant): boolean {
  const likes = readLikes();
  const isLiked = likes.some(r => r.id === rest.id);
  writeLikes(isLiked ? likes.filter(r => r.id !== rest.id) : [...likes, rest]);
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

function insertAt(list: Restaurant[], rest: Restaurant, index: number): Restaurant[] {
  if (list.some(r => r.id === rest.id)) return list;
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), list.length) : list.length;
  return [...list.slice(0, at), rest, ...list.slice(at)];
}

/** Annule un retrait : remet le favori à sa place et reprogramme la question de visite. */
export function restoreLike(rest: Restaurant, index: number): void {
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
