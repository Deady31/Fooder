import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { mergeKey } from '../lib/cloud/merge';
import { LIKES_KEY, LIKE_SORT_KEY, addedLabel, parseLikeSort, readLikeSort, readLikes, sortLikes, toggleLike, removeLike, restoreLike, writeLikeSort } from '../lib/likes';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const rest = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `Resto ${id}`, rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Italien', image: '', address: 'Rue', lat: 43.6, lng: 1.44, description: '', ...extra }) as Restaurant & { likedAt?: number };

let storage: ReturnType<typeof makeStorage>;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('likedAt à l’enregistrement', () => {
  it('toggleLike enregistre la date du like', () => {
    toggleLike(rest('a'), 1000);
    expect((readLikes()[0] as { likedAt?: number }).likedAt).toBe(1000);
  });
  it('un retrait annulé garde la date d’origine', () => {
    toggleLike(rest('a'), 1000);
    const out = removeLike('a')!;
    restoreLike(out.rest, out.index);
    expect((readLikes()[0] as { likedAt?: number }).likedAt).toBe(1000);
  });
  it('les anciens likes sans date sont lus sans erreur', () => {
    storage.setItem(LIKES_KEY, JSON.stringify([rest('old1'), rest('old2')]));
    expect(readLikes().map(r => r.id)).toEqual(['old1', 'old2']);
    toggleLike(rest('new'), 5000);
    expect(readLikes().map(r => r.id)).toEqual(['old1', 'old2', 'new']);
  });
});

describe('sortLikes', () => {
  const a = rest('a', { name: 'Zèbre', likedAt: 100, lat: 43.61, lng: 1.44 });
  const b = rest('b', { name: 'Agneau', likedAt: 300, lat: 43.7, lng: 1.44 });
  const c = rest('c', { name: 'école', likedAt: 200, lat: 43.605, lng: 1.444 });
  const old1 = rest('o1', { name: 'Vieux un' });
  const old2 = rest('o2', { name: 'Vieux deux' });
  const ids = (l: readonly { id: string }[]) => l.map(r => r.id);
  const HERE = { lat: 43.6045, lng: 1.4442 };

  it('récents : du plus récent au plus ancien, sans date en dernier dans leur ordre', () => {
    expect(ids(sortLikes([old1, a, old2, b, c], 'recent', null))).toEqual(['b', 'c', 'a', 'o1', 'o2']);
  });
  it('anciens : sans date d’abord (ordre actuel), puis du plus ancien au plus récent', () => {
    expect(ids(sortLikes([a, old1, b, old2, c], 'ancien', null))).toEqual(['o1', 'o2', 'a', 'c', 'b']);
  });
  it('égalité de date : l’ordre actuel est conservé', () => {
    const x = rest('x', { likedAt: 50 });
    const y = rest('y', { likedAt: 50 });
    expect(ids(sortLikes([x, y], 'recent', null))).toEqual(['x', 'y']);
    expect(ids(sortLikes([y, x], 'ancien', null))).toEqual(['y', 'x']);
  });
  it('A→Z : sans accents ni casse', () => {
    expect(ids(sortLikes([a, b, c], 'az', null))).toEqual(['b', 'c', 'a']);
  });
  it('A→Z : égalité de nom, ordre actuel conservé', () => {
    const p = rest('p', { name: 'Same' });
    const q = rest('q', { name: 'same' });
    expect(ids(sortLikes([q, p], 'az', null))).toEqual(['q', 'p']);
  });
  it('plus proches : par distance croissante', () => {
    expect(ids(sortLikes([b, a, c], 'proche', HERE))).toEqual(['c', 'a', 'b']);
  });
  it('plus proches : coordonnées absentes ou invalides en dernier', () => {
    const bad = rest('bad', { lat: Number.NaN, lng: 1 });
    expect(ids(sortLikes([bad, b, c], 'proche', HERE))).toEqual(['c', 'b', 'bad']);
  });
  it('plus proches sans position : repli sur les récents', () => {
    expect(ids(sortLikes([a, b, c], 'proche', null))).toEqual(['b', 'c', 'a']);
  });
  it('ne mute pas la liste et gère le vide ou l’invalide', () => {
    const list = [a, b];
    sortLikes(list, 'recent', null);
    expect(ids(list)).toEqual(['a', 'b']);
    expect(sortLikes([], 'az', null)).toEqual([]);
    expect(sortLikes(null as unknown as Restaurant[], 'az', null)).toEqual([]);
  });
  it('dates invalides (texte, NaN) = sans date', () => {
    const weird = rest('w', { likedAt: 'hier' });
    expect(ids(sortLikes([weird, a], 'recent', null))).toEqual(['a', 'w']);
  });
});

describe('tri mémorisé', () => {
  it('défaut : récents', () => {
    expect(readLikeSort()).toBe('recent');
  });
  it('écrit puis relit', () => {
    writeLikeSort('az');
    expect(storage.getItem(LIKE_SORT_KEY)).not.toBeNull();
    expect(readLikeSort()).toBe('az');
  });
  it('valeur inconnue : récents', () => {
    expect(parseLikeSort('n’importe quoi')).toBe('recent');
    expect(parseLikeSort(null)).toBe('recent');
  });
});

describe('addedLabel', () => {
  const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();
  it('« ajouté le 12 nov » (année courante)', () => {
    expect(addedLabel(noon(2026, 10, 12), noon(2026, 10, 14))).toBe('ajouté le 12 nov');
  });
  it('année passée : l’année est précisée', () => {
    expect(addedLabel(noon(2025, 11, 3), noon(2026, 10, 14))).toBe('ajouté le 3 déc 2025');
  });
  it('1er du mois et accents', () => {
    expect(addedLabel(noon(2026, 1, 1), noon(2026, 10, 14))).toBe('ajouté le 1er févr');
    expect(addedLabel(noon(2026, 7, 20), noon(2026, 10, 14))).toBe('ajouté le 20 août');
  });
  it('sans date ou invalide : null', () => {
    expect(addedLabel(undefined)).toBeNull();
    expect(addedLabel(Number.NaN)).toBeNull();
    expect(addedLabel('x' as never)).toBeNull();
  });
});

describe('fusion cloud des likes : date la plus ancienne', () => {
  it('garde la date la plus ancienne quand elle existe des deux côtés', () => {
    const out = mergeKey('fooder_likes', [{ id: 'a', likedAt: 500 }], [{ id: 'a', likedAt: 200 }]) as { id: string; likedAt?: number }[];
    expect(out).toEqual([{ id: 'a', likedAt: 200 }]);
    const out2 = mergeKey('fooder_likes', [{ id: 'a', likedAt: 100 }], [{ id: 'a', likedAt: 900 }]) as { likedAt?: number }[];
    expect(out2[0].likedAt).toBe(100);
  });
  it('une seule date connue : on la garde', () => {
    expect((mergeKey('fooder_likes', [{ id: 'a' }], [{ id: 'a', likedAt: 7 }]) as { likedAt?: number }[])[0].likedAt).toBe(7);
    expect((mergeKey('fooder_likes', [{ id: 'a', likedAt: 7 }], [{ id: 'a' }]) as { likedAt?: number }[])[0].likedAt).toBe(7);
  });
  it('aucune date : rien n’est ajouté, ordre local conservé', () => {
    const out = mergeKey('fooder_likes', [{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]) as Record<string, unknown>[];
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect('likedAt' in out[0]).toBe(false);
  });
  it('les écartés ne changent pas', () => {
    const out = mergeKey('fooder_dislikes', [{ id: 'a', likedAt: 5 }], [{ id: 'a', likedAt: 1 }]) as { likedAt?: number }[];
    expect(out[0].likedAt).toBe(5);
  });
});
