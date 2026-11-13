import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { STORE_EVENT } from '../lib/store';
import {
  DISLIKES_KEY, LIKES_KEY, WISHLIST_KEY,
  likedIds, likesCount, readDislikes, readLikes, removeDislike, removeLike, restoreDislike, restoreLike,
  subscribeLikes, toggleLike,
} from '../lib/likes';
import { CHECKINS_KEY } from '../lib/visits';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const rest = (id: string, extra: Partial<Restaurant> = {}): Restaurant =>
  ({ id, name: `Resto ${id}`, rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Italien', image: '', address: 'Rue', lat: 43.6, lng: 1.44, description: '', ...extra }) as Restaurant;

let storage: ReturnType<typeof makeStorage>;
let events: string[];
let listeners: Map<string, Set<(e: Event) => void>>;

beforeEach(() => {
  storage = makeStorage();
  events = [];
  listeners = new Map();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', {
    dispatchEvent: (e: Event) => {
      if (e.type === STORE_EVENT) events.push((e as CustomEvent<string>).detail);
      listeners.get(e.type)?.forEach(l => l(e));
      return true;
    },
    addEventListener: (t: string, l: (e: Event) => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(l);
    },
    removeEventListener: (t: string, l: (e: Event) => void) => { listeners.get(t)?.delete(l); },
  });
});

afterEach(() => vi.unstubAllGlobals());

const ids = () => readLikes().map(r => r.id);

describe('lecture', () => {
  it('liste vide par défaut, JSON corrompu toléré', () => {
    expect(readLikes()).toEqual([]);
    storage.setItem(LIKES_KEY, '{oups');
    expect(readLikes()).toEqual([]);
    storage.setItem(LIKES_KEY, '{"a":1}');
    expect(readLikes()).toEqual([]);
  });

  it('retombe sur la wishlist seulement si la clé des likes est absente', () => {
    storage.setItem(WISHLIST_KEY, JSON.stringify([rest('w1')]));
    expect(ids()).toEqual(['w1']);
    storage.setItem(LIKES_KEY, '[]');
    expect(ids()).toEqual([]);
  });

  it('ignore les entrées sans id et les doublons', () => {
    storage.setItem(LIKES_KEY, JSON.stringify([rest('a'), null, { name: 'x' }, rest('a'), rest('b')]));
    expect(ids()).toEqual(['a', 'b']);
  });

  it('likedIds et likesCount reflètent la liste', () => {
    storage.setItem(LIKES_KEY, JSON.stringify([rest('a'), rest('b')]));
    expect(likesCount()).toBe(2);
    expect(likedIds().has('b')).toBe(true);
  });
});

describe('toggleLike', () => {
  it('ajoute puis retire, écrit likes et wishlist et émet un événement', () => {
    expect(toggleLike(rest('a'))).toBe(true);
    expect(ids()).toEqual(['a']);
    expect(JSON.parse(storage.getItem(WISHLIST_KEY)!)).toHaveLength(1);
    expect(events).toContain(LIKES_KEY);
    expect(toggleLike(rest('a'))).toBe(false);
    expect(ids()).toEqual([]);
  });
});

describe('removeLike / restoreLike', () => {
  beforeEach(() => storage.setItem(LIKES_KEY, JSON.stringify([rest('a'), rest('b'), rest('c')])));

  it('retire, renvoie le resto et sa position, et émet', () => {
    const out = removeLike('b');
    expect(out?.rest.id).toBe('b');
    expect(out?.index).toBe(1);
    expect(ids()).toEqual(['a', 'c']);
    expect(events).toContain(LIKES_KEY);
  });

  it('id inconnu : rien ne change, pas d’événement', () => {
    expect(removeLike('zzz')).toBeNull();
    expect(events).toEqual([]);
  });

  it('restaure à la même place, sans doublon', () => {
    const out = removeLike('b')!;
    restoreLike(out.rest, out.index);
    expect(ids()).toEqual(['a', 'b', 'c']);
    restoreLike(out.rest, out.index);
    expect(ids()).toEqual(['a', 'b', 'c']);
  });

  it('position hors limites : ajoute à la fin', () => {
    restoreLike(rest('d'), 99);
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('supprime le check-in en attente du resto retiré, garde les autres', () => {
    const base = { name: 'x', cuisine: 'y', dueAt: 1 };
    storage.setItem(CHECKINS_KEY, JSON.stringify([
      { ...base, restId: 'b', status: 'pending' },
      { ...base, restId: 'c', status: 'pending' },
      { ...base, restId: 'a', status: 'done' },
    ]));
    removeLike('b');
    removeLike('a');
    const left = JSON.parse(storage.getItem(CHECKINS_KEY)!) as { restId: string; status: string }[];
    expect(left.map(c => c.restId)).toEqual(['c', 'a']);
  });

  it('la restauration reprogramme le check-in', () => {
    const out = removeLike('b')!;
    restoreLike(out.rest, out.index);
    const list = JSON.parse(storage.getItem(CHECKINS_KEY) ?? '[]') as { restId: string }[];
    expect(list.some(c => c.restId === 'b')).toBe(true);
  });
});

describe('écartés', () => {
  it('retire et restaure sans toucher aux likes', () => {
    storage.setItem(DISLIKES_KEY, JSON.stringify([rest('x'), rest('y')]));
    const out = removeDislike('x');
    expect(readDislikes().map(r => r.id)).toEqual(['y']);
    restoreDislike(out!.rest, out!.index);
    expect(readDislikes().map(r => r.id)).toEqual(['x', 'y']);
    expect(readLikes()).toEqual([]);
  });
});

describe('subscribeLikes', () => {
  it('notifie quand les likes changent, pas pour une autre clé, et se désabonne', () => {
    const cb = vi.fn();
    const off = subscribeLikes(cb);
    toggleLike(rest('a'));
    expect(cb).toHaveBeenCalled();
    cb.mockClear();
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: 'fooder_xp' }));
    expect(cb).not.toHaveBeenCalled();
    off();
    toggleLike(rest('b'));
    expect(cb).not.toHaveBeenCalled();
  });
});
