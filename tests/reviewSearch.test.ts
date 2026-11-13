import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer, filterPosts, foldText, parseQueryParam, reviewsHref, searchView } from '../components/feed/reviewSearch';
import type { FeedPost } from '../lib/feed';

const AVATAR = { id: 'burger', bg: 'bubblegum' } as FeedPost['author']['avatar'];
const post = (over: Partial<FeedPost>): FeedPost => ({
  id: 'p',
  author: { name: 'lea_mange', avatar: AVATAR, level: 3 },
  restaurantId: 'osm-n1',
  restaurantName: 'Café Éclair',
  cuisine: 'Café',
  sticker: 'burger',
  caption: 'Excellent gâteau au chocolat',
  verdict: 'miam',
  likes: 0,
  createdAt: 1,
  ...over,
});

const POSTS = [
  post({ id: '1' }),
  post({ id: '2', restaurantName: 'Ramen du Capitole', cuisine: 'Japonais', caption: 'Bouillon parfait', verdict: 'atester', author: { name: 'tom.bao', avatar: AVATAR, level: 1 } }),
  post({ id: '3', restaurantName: 'Burger de Compans', cuisine: 'Burger', caption: '', verdict: 'bof', mine: true }),
  post({ id: 'seed-4' }),
];

describe('foldText', () => {
  it('retire accents et casse, nettoie les espaces', () => {
    expect(foldText('  Café ÉCLAIR  ')).toBe('cafe eclair');
    expect(foldText('')).toBe('');
    expect(foldText(undefined as unknown as string)).toBe('');
  });
});

describe('filterPosts', () => {
  const ids = (q: string) => filterPosts(POSTS, q).map(p => p.id);

  it('requête vide : tout est renvoyé', () => {
    expect(ids('')).toHaveLength(POSTS.length);
    expect(ids('   ')).toHaveLength(POSTS.length);
  });

  it('insensible aux accents et à la casse', () => {
    expect(ids('cafe')).toEqual(['1', 'seed-4']);
    expect(ids('ÉCLAIR')).toEqual(['1', 'seed-4']);
    expect(ids('eclair')).toEqual(['1', 'seed-4']);
  });

  it('nom partiel du restaurant', () => {
    expect(ids('capit')).toEqual(['2']);
    expect(ids('comp')).toEqual(['3']);
  });

  it('cherche aussi dans le texte de l’avis, la cuisine, l’auteur et le verdict', () => {
    expect(ids('bouillon')).toEqual(['2']);
    expect(ids('japon')).toEqual(['2']);
    expect(ids('tom.bao')).toEqual(['2']);
    expect(ids('bof')).toEqual(['3']);
    expect(ids('à tester')).toEqual(['2']);
  });

  it('mes avis se retrouvent avec « toi »', () => {
    expect(ids('toi')).toEqual(['3']);
  });

  it('plusieurs mots : tous doivent correspondre, dans n’importe quel ordre', () => {
    expect(ids('chocolat cafe')).toEqual(['1', 'seed-4']);
    expect(ids('ramen chocolat')).toEqual([]);
  });

  it('aucun résultat pour un mot inconnu, sans planter sur des champs manquants', () => {
    expect(ids('zzzz')).toEqual([]);
    const broken = [{ ...post({ id: 'x' }), caption: undefined, restaurantName: undefined } as unknown as FeedPost];
    expect(filterPosts(broken, 'zz')).toEqual([]);
    expect(filterPosts(null as unknown as FeedPost[], 'a')).toEqual([]);
  });

  it('exclut les exemples de démo quand on cherche (jamais de faux avis dans une recherche)', () => {
    expect(filterPosts(POSTS, 'cafe', { excludeDemo: true }).map(p => p.id)).toEqual(['1']);
  });

  it('ne modifie pas la liste d’origine', () => {
    const copy = [...POSTS];
    filterPosts(POSTS, 'cafe');
    expect(POSTS).toEqual(copy);
  });
});

describe('reviewsHref', () => {
  it('lien vers le fil pré-filtré, nom encodé', () => {
    expect(reviewsHref('osm-n1', 'Café Éclair & fils')).toBe('/feed?q=Caf%C3%A9%20%C3%89clair%20%26%20fils');
  });

  it('nom vide : fil non filtré', () => {
    expect(reviewsHref('osm-n1', '   ')).toBe('/feed');
  });

  it('plafonne la longueur du nom', () => {
    const href = reviewsHref('osm-n1', 'a'.repeat(500));
    expect(decodeURIComponent(href.slice('/feed?q='.length)).length).toBe(60);
  });
});

describe('parseQueryParam', () => {
  it('nettoie, plafonne et tolère null', () => {
    expect(parseQueryParam(null)).toBe('');
    expect(parseQueryParam('  Ramen\u0000\u0007 ')).toBe('Ramen');
    expect(parseQueryParam('x'.repeat(200))).toHaveLength(60);
  });
});

describe('searchView (état de l’écran)', () => {
  it('sans recherche : inactif', () => {
    expect(searchView({ typed: '', settled: '', resultCount: 5 })).toBe('idle');
  });

  it('pendant la frappe (avant le délai) : chargement', () => {
    expect(searchView({ typed: 'ram', settled: '', resultCount: 0 })).toBe('loading');
  });

  it('délai écoulé : résultats ou état vide honnête', () => {
    expect(searchView({ typed: 'ram', settled: 'ram', resultCount: 2 })).toBe('results');
    expect(searchView({ typed: 'ram', settled: 'ram', resultCount: 0 })).toBe('empty');
  });

  it('ignore les espaces de bord', () => {
    expect(searchView({ typed: ' ram ', settled: 'ram', resultCount: 1 })).toBe('results');
  });
});

describe('createDebouncer (300 ms)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ne déclenche qu’avec la dernière valeur, après le délai', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 300);
    d.call('r');
    vi.advanceTimersByTime(200);
    d.call('ra');
    vi.advanceTimersByTime(200);
    d.call('ram');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('ram');
  });

  it('cancel() annule l’appel en attente (démontage sans fuite)', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 300);
    d.call('x');
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() déclenche tout de suite (effacer la recherche)', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 300);
    d.call('x');
    d.flush('');
    expect(fn).toHaveBeenCalledWith('');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
