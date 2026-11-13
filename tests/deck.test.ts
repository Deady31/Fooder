import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { mockRestaurants } from '../data/mockRestaurants';
import {
  DEFAULT_RADIUS_M,
  RADIUS_STEPS,
  nextRadiusWithResults,
  parseRadius,
  radiusLabel,
  serializeRadius,
} from '../lib/geo/radius';
import {
  appendBottom,
  clearDeckSnapshot,
  loadDeckSnapshot,
  remaining,
  reorderUpcoming,
  saveDeckSnapshot,
  swipeIndex,
  undoIndex,
  type Deck,
} from '../lib/deckStore';
import {
  buildApiQuery,
  initialDeck,
  matchesMood,
  orderDeck,
  parseApiPage,
  seenIdsFrom,
  withDistances,
} from '../lib/deckLoader';
import { createPositionTracker, initialPosition, type GeolocationLike } from '../lib/geo/position';

const mk = (id: string, lat?: number, lng?: number, extra: Partial<Restaurant> = {}): Restaurant =>
  ({ id, name: id, cuisine: 'Pizzeria', price: 0, rating: 0, distance: '', description: '', image: '', address: '', lat, lng,
    hours: [[[0, 1440]], [[0, 1440]], [[0, 1440]], [[0, 1440]], [[0, 1440]], [[0, 1440]], [[0, 1440]]], website: 'https://x.fr', ...extra }) as Restaurant;

const ORIGIN = { lat: 43.6045, lng: 1.4442 };

describe('rayon', () => {
  it('paliers et defaut 2 km', () => {
    expect(RADIUS_STEPS).toEqual([500, 1000, 2000, 5000, 10000, null]);
    expect(DEFAULT_RADIUS_M).toBe(2000);
  });

  it('lecture defensive et ecriture', () => {
    expect(parseRadius(500)).toBe(500);
    expect(parseRadius('metro')).toBeNull();
    expect(parseRadius(1234)).toBe(2000);
    expect(parseRadius(undefined)).toBe(2000);
    expect(serializeRadius(null)).toBe('metro');
    expect(serializeRadius(5000)).toBe(5000);
  });

  it('libelles', () => {
    expect(RADIUS_STEPS.map(radiusLabel)).toEqual(['500 m', '1 km', '2 km', '5 km', '10 km', 'Toute la métropole']);
  });

  it('prochain palier qui apporte des resultats', () => {
    const counts: Record<string, number> = { 500: 0, 1000: 0, 2000: 0, 5000: 0, 10000: 3, metro: 7 };
    const count = (r: number | null) => counts[String(r ?? 'metro')];
    expect(nextRadiusWithResults(2000, count)).toBe(10000);
    expect(nextRadiusWithResults(10000, count)).toBeNull();
    expect(nextRadiusWithResults(null, count)).toBeUndefined();
    expect(nextRadiusWithResults(500, () => 0)).toBeUndefined();
  });
});

describe('deck : carte du dessus jamais changee par un reordonnancement', () => {
  // Liste inversée : la carte du dessus est à `index`.
  const a = mk('a', 43.62, 1.44); // loin
  const b = mk('b', 43.605, 1.4443); // tout près
  const c = mk('c', 43.61, 1.444);
  const top = mk('top', 43.7, 1.5); // très loin mais affichée
  const swiped = mk('done', 43.6, 1.44);
  const deck: Deck = { list: [a, b, c, top, swiped], index: 3 };

  it('reordonne seulement les cartes a venir, carte(s) epinglee(s) intactes', () => {
    const out = reorderUpcoming(deck, ORIGIN, new Set(['top']));
    expect(out.list[out.index].id).toBe('top');
    // à venir : la plus proche juste sous la carte du dessus
    expect(remaining(out).map(r => r.id)).toEqual(['a', 'c', 'b', 'top']);
    expect(out.list.slice(out.index + 1).map(r => r.id)).toEqual(['done']);
    expect(deck.list.map(r => r.id)).toEqual(['a', 'b', 'c', 'top', 'done']); // pas de mutation
  });

  it('fusionne de nouveaux restos sans doublon ni carte deja vue', () => {
    const fresh = [mk('b', 43.605, 1.4443), mk('n', 43.6046, 1.4442), mk('done', 43.6, 1.44)];
    const out = reorderUpcoming(deck, ORIGIN, new Set(['top']), fresh);
    expect(out.list[out.index].id).toBe('top');
    expect(remaining(out).map(r => r.id)).toEqual(['a', 'c', 'b', 'n', 'top']);
  });

  it('ajout en bas de pile et index decale', () => {
    const out = appendBottom(deck, [mk('x'), mk('y')]);
    expect(out.list.map(r => r.id)).toEqual(['y', 'x', 'a', 'b', 'c', 'top', 'done']);
    expect(out.list[out.index].id).toBe('top');
  });

  it('swipe et annulation', () => {
    expect(swipeIndex(deck, 'top', 0)).toBe(2);
    expect(swipeIndex(deck, 'inconnu', 1)).toBe(0);
    expect(undoIndex({ ...deck, index: 2 }, 'top')).toBe(3);
    expect(undoIndex(deck, 'inconnu')).toBeNull();
  });
});

describe('memoire de session du deck (retour sur l onglet)', () => {
  afterEach(() => clearDeckSnapshot());
  const snap = { deck: { list: [mk('a')], index: 0 }, all: [mk('a')], origin: ORIGIN, moodId: 'surprise', page: { offset: 50, total: 900 } };

  it('rend la meme pile pendant 10 min, pour la meme humeur', () => {
    saveDeckSnapshot(snap, 1000);
    expect(loadDeckSnapshot('surprise', 1000 + 9 * 60_000)?.deck.list[0].id).toBe('a');
    expect(loadDeckSnapshot('asie', 2000)).toBeNull();
    expect(loadDeckSnapshot('surprise', 1000 + 11 * 60_000)).toBeNull();
  });
});

describe('chargement du deck', () => {
  it('requete API : coordonnees arrondies a 3 decimales au plus', () => {
    const qs = new URLSearchParams(buildApiQuery({ lat: 43.60451234, lng: 1.44429876 }, 50));
    expect(qs.get('lat')).toBe('43.605');
    expect(qs.get('lng')).toBe('1.444');
    expect(qs.get('offset')).toBe('50');
    expect(new URLSearchParams(buildApiQuery(null, 0)).has('lat')).toBe(false);
  });

  it('lecture defensive de la page API', () => {
    expect(parseApiPage({ success: true, data: [mk('a')], meta: { total: 9 } })).toMatchObject({ total: 9 });
    expect(parseApiPage({ success: false })).toBeNull();
    expect(parseApiPage('x')).toBeNull();
  });

  it('distances reelles (haversine) depuis la vraie position, marquees depuis le centre par defaut', () => {
    const [r] = withDistances([mk('a', 43.6045, 1.4567)], ORIGIN, 'gps');
    expect(r.distanceMeters).toBeGreaterThan(990);
    expect(r.distanceMeters).toBeLessThan(1020);
    expect(r.distance).toBe('1,0 km');
    expect(withDistances([mk('a', 43.6045, 1.4567)], ORIGIN, 'default')[0].distance).toBe('~1,0 km du centre');
    expect(withDistances([mk('z')], ORIGIN, 'gps')[0].distance).toBe('');
  });

  it('ordre : sponsorises, puis fiches riches par distance', () => {
    const far = mk('far', 43.65, 1.44);
    const nearPoor = mk('poor', 43.6046, 1.4442, { hours: undefined, website: undefined, cuisine: 'Restaurant' });
    const near = mk('near', 43.6047, 1.4442);
    const spons = mk('sp', 43.7, 1.5, { sponsored: true });
    expect(orderDeck([far, nearPoor, near, spons], ORIGIN).map(r => r.id)).toEqual(['sp', 'near', 'far', 'poor']);
  });

  it('humeur et cartes deja vues', () => {
    expect(matchesMood(mk('x', 0, 0, { cuisine: 'Ramen' }), 'asie')).toBe(true);
    expect(matchesMood(mk('x', 0, 0, { cuisine: 'Pizzeria' }), 'asie')).toBe(false);
    expect(seenIdsFrom([[{ id: 'a' }], 'oups', [{ id: 'b' }, null]])).toEqual(new Set(['a', 'b']));
  });

  it('premiere carte immediate : pile construite sans reseau ni geolocalisation, en moins de 400 ms', () => {
    // Faux navigator.geolocation qui ne répond jamais.
    const never: GeolocationLike = { getCurrentPosition: () => undefined, watchPosition: () => 1, clearWatch: () => undefined };
    const t0 = performance.now();
    const tracker = createPositionTracker(never, { onFix: vi.fn(), onError: vi.fn() });
    tracker.start();
    const pos = initialPosition(null, null);
    const deck = initialDeck({ mock: mockRestaurants, api: [], seen: new Set(), moodId: 'surprise', origin: pos.coords, source: pos.source });
    const elapsed = performance.now() - t0;
    tracker.stop();
    expect(deck.list.length).toBeGreaterThan(0);
    expect(deck.list[deck.index]).toBeDefined();
    expect(elapsed).toBeLessThan(400);
  });
});
