import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  applyFeedFilters,
  filterByResto,
  filterByScope,
  filtersToQuery,
  hasActiveFilters,
  isFriendPost,
  normalizeUserId,
  parseFilters,
  parseStoredFilters,
  restaurantOptions,
} from '../components/feed/feedFilters';
import { FeedPost } from '../lib/feed';

const AUTHOR = { name: 'lea', avatar: { id: 'donut', bg: 'lemon' }, level: 2 };
const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_A = 'aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa';
const ID_B = 'bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb';

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: 'p1',
  author: AUTHOR,
  restaurantId: 'osm-n1',
  restaurantName: 'Chez Test',
  cuisine: 'Burger',
  sticker: 'burger',
  caption: '',
  verdict: 'miam',
  likes: 0,
  createdAt: 1,
  ...over,
});

const friendPost = post({ id: 'f1', authorId: ID_A, restaurantId: 'osm-n1', restaurantName: 'Café Éclair' });
const strangerPost = post({ id: 's1', authorId: ID_B, restaurantId: 'osm-n2', restaurantName: 'Pizza Roma' });
const minePost = post({ id: 'm1', mine: true, restaurantId: 'osm-n2', restaurantName: 'Pizza Roma' });
const visitPost = post({ id: 'visit-osm-n3-5', mine: true, restaurantId: 'osm-n3', restaurantName: 'Sushi Bar' });
const noAuthor = post({ id: 'n1', restaurantId: 'osm-n4', restaurantName: 'Inconnu' });
const demo = post({ id: 'seed-1', restaurantId: 'seed-r2', restaurantName: 'Ramen du Capitole' });
const ALL = [friendPost, strangerPost, minePost, visitPost, noAuthor, demo];
const FRIENDS = new Set([ID_A]);

describe('normalizeUserId', () => {
  it('retire les tirets et met en minuscules', () => {
    expect(normalizeUserId(UUID_A.toUpperCase())).toBe(ID_A);
  });
  it('refuse les valeurs invalides', () => {
    expect(normalizeUserId('')).toBeNull();
    expect(normalizeUserId(null)).toBeNull();
    expect(normalizeUserId(42)).toBeNull();
    expect(normalizeUserId('pas-un-id')).toBeNull();
  });
});

describe('isFriendPost / filterByScope', () => {
  it('amis : seulement les auteurs qui sont dans mes amis', () => {
    expect(isFriendPost(friendPost, FRIENDS)).toBe(true);
    expect(isFriendPost(strangerPost, FRIENDS)).toBe(false);
    expect(filterByScope(ALL, 'amis', FRIENDS).map(p => p.id)).toEqual(['f1']);
  });
  it('amis : accepte un authorId au format UUID', () => {
    expect(isFriendPost(post({ authorId: UUID_A }), FRIENDS)).toBe(true);
  });
  it('amis : un post sans auteur connu, un exemple ou mon post ne comptent jamais', () => {
    expect(isFriendPost(noAuthor, FRIENDS)).toBe(false);
    expect(isFriendPost(demo, FRIENDS)).toBe(false);
    expect(isFriendPost(minePost, FRIENDS)).toBe(false);
  });
  it('amis : aucun ami => liste vide', () => {
    expect(filterByScope(ALL, 'amis', new Set())).toEqual([]);
  });
  it('moi : mes posts et mes visites', () => {
    expect(filterByScope(ALL, 'moi', FRIENDS).map(p => p.id)).toEqual(['m1', 'visit-osm-n3-5']);
  });
  it('tous : tout, sans muter la liste', () => {
    const copy = [...ALL];
    const out = filterByScope(ALL, 'tous', FRIENDS);
    expect(out).toEqual(ALL);
    expect(out).not.toBe(ALL);
    expect(ALL).toEqual(copy);
  });
  it('entrée invalide : liste vide', () => {
    expect(filterByScope(null as unknown as FeedPost[], 'moi', FRIENDS)).toEqual([]);
  });
});

describe('filterByResto', () => {
  it('garde les posts du resto choisi', () => {
    expect(filterByResto(ALL, 'osm-n2').map(p => p.id)).toEqual(['s1', 'm1']);
  });
  it('null : tout', () => {
    expect(filterByResto(ALL, null)).toHaveLength(ALL.length);
  });
  it('resto inconnu : vide', () => {
    expect(filterByResto(ALL, 'osm-zzz')).toEqual([]);
  });
});

describe('applyFeedFilters (combinaisons)', () => {
  const run = (query: string, scope: 'tous' | 'amis' | 'moi', resto: string | null, posts = ALL) =>
    applyFeedFilters(posts, { query, filters: { scope, resto }, friendIds: FRIENDS }).map(p => p.id);

  it('rien d’actif : tout, exemples compris (le fil vide les montre déjà marqués)', () => {
    expect(run('', 'tous', null)).toHaveLength(ALL.length);
  });
  it('amis + resto', () => {
    expect(run('', 'amis', 'osm-n1')).toEqual(['f1']);
    expect(run('', 'amis', 'osm-n2')).toEqual([]);
  });
  it('moi + resto', () => {
    expect(run('', 'moi', 'osm-n2')).toEqual(['m1']);
    expect(run('', 'moi', 'osm-n3')).toEqual(['visit-osm-n3-5']);
  });
  it('recherche + amis, accents et casse ignorés', () => {
    expect(run('CAFE eclair', 'amis', null)).toEqual(['f1']);
    expect(run('pizza', 'amis', null)).toEqual([]);
  });
  it('recherche + moi + resto', () => {
    expect(run('pizza', 'moi', 'osm-n2')).toEqual(['m1']);
    expect(run('sushi', 'moi', 'osm-n2')).toEqual([]);
  });
  it('un filtre actif écarte toujours les exemples fictifs', () => {
    expect(run('', 'tous', 'seed-r2')).toEqual([]);
    expect(run('ramen', 'tous', null)).toEqual([]);
  });
  it('liste vide : vide', () => {
    expect(run('', 'amis', null, [])).toEqual([]);
  });
});

describe('restaurantOptions', () => {
  it('liste les restos qui ont des posts, du plus commenté au moins, sans exemples', () => {
    const opts = restaurantOptions(ALL);
    expect(opts.map(o => o.id)).toEqual(['osm-n2', 'osm-n1', 'osm-n4', 'osm-n3']);
    expect(opts[0]).toMatchObject({ id: 'osm-n2', name: 'Pizza Roma', count: 2 });
    expect(opts.some(o => o.id === 'seed-r2')).toBe(false);
  });
  it('égalité de compte : ordre alphabétique', () => {
    const opts = restaurantOptions([post({ id: 'a', restaurantId: 'x', restaurantName: 'Zèbre' }), post({ id: 'b', restaurantId: 'y', restaurantName: 'Agneau' })]);
    expect(opts.map(o => o.name)).toEqual(['Agneau', 'Zèbre']);
  });
  it('recherche sans accents ni casse', () => {
    expect(restaurantOptions(ALL, 'CAFE').map(o => o.id)).toEqual(['osm-n1']);
    expect(restaurantOptions(ALL, 'zzz')).toEqual([]);
  });
  it('liste vide ou invalide : vide', () => {
    expect(restaurantOptions([])).toEqual([]);
    expect(restaurantOptions(undefined as unknown as FeedPost[])).toEqual([]);
  });
});

describe('URL et mémoire des filtres', () => {
  it('lit ?scope=amis&resto=<id>', () => {
    expect(parseFilters(new URLSearchParams('scope=amis&resto=osm-n1'))).toEqual({ scope: 'amis', resto: 'osm-n1' });
  });
  it('valeurs inconnues ou dangereuses : repli sur les défauts', () => {
    expect(parseFilters(new URLSearchParams('scope=admin&resto=<script>'))).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(new URLSearchParams('resto=' + 'a'.repeat(200)))).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(null)).toEqual(DEFAULT_FILTERS);
  });
  it('écrit une requête lisible, vide si rien n’est actif', () => {
    expect(filtersToQuery({ scope: 'amis', resto: 'osm-n1' })).toBe('scope=amis&resto=osm-n1');
    expect(filtersToQuery({ scope: 'moi', resto: null })).toBe('scope=moi');
    expect(filtersToQuery({ scope: 'tous', resto: 'osm-n1' })).toBe('resto=osm-n1');
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe('');
  });
  it('relit la mémoire défensivement', () => {
    expect(parseStoredFilters({ scope: 'moi', resto: 'osm-n2' })).toEqual({ scope: 'moi', resto: 'osm-n2' });
    expect(parseStoredFilters('n’importe quoi')).toEqual(DEFAULT_FILTERS);
    expect(parseStoredFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(parseStoredFilters({ scope: 7, resto: {} })).toEqual(DEFAULT_FILTERS);
  });
  it('hasActiveFilters', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ scope: 'amis', resto: null })).toBe(true);
    expect(hasActiveFilters({ scope: 'tous', resto: 'osm-n1' })).toBe(true);
  });
});
