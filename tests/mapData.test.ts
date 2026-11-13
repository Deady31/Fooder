import { describe, expect, it } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { MAX_PLACES, hasMovedFar, mergePlaces, nearbyUrl, scopePlaces, toFeatureCollection } from '../components/map/mapData';

const r = (id: string, lat: number | undefined = 43.6, lng: number | undefined = 1.44): Restaurant =>
  ({ id, name: `R${id}`, rating: 0, price: 0, distance: '', cuisine: 'Italien', image: '', address: '', lat, lng, description: '' }) as Restaurant;

describe('mergePlaces', () => {
  it('met les coups de cœur d’abord, sans doublon, et garde la fiche du like', () => {
    const liked = { ...r('a'), name: 'Liké' };
    const out = mergePlaces([liked], [r('b'), r('a'), r('c')]);
    expect(out.map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].name).toBe('Liké');
  });

  it('écarte les fiches sans coordonnées valides', () => {
    const out = mergePlaces([{ ...r('a'), lat: undefined, lng: undefined }], [r('b', NaN, 1), r('c', 91, 1), r('d')]);
    expect(out.map(p => p.id)).toEqual(['d']);
  });

  it('plafonne le total mais ne perd jamais un coup de cœur', () => {
    const many = Array.from({ length: MAX_PLACES + 50 }, (_, i) => r(`n${i}`));
    const out = mergePlaces([r('fav')], many);
    expect(out).toHaveLength(MAX_PLACES);
    expect(out[0].id).toBe('fav');
  });

  it('entrées vides', () => {
    expect(mergePlaces([], [])).toEqual([]);
  });
});

describe('scopePlaces', () => {
  const all = [r('a'), r('b'), r('c')];
  it('« tous » rend tout, « coups de cœur » filtre sur les ids likés', () => {
    expect(scopePlaces(all, 'all', new Set(['a']))).toHaveLength(3);
    expect(scopePlaces(all, 'liked', new Set(['a', 'c'])).map(p => p.id)).toEqual(['a', 'c']);
    expect(scopePlaces(all, 'liked', new Set())).toEqual([]);
  });
});

describe('toFeatureCollection', () => {
  it('produit des points [lng, lat] avec l’id', () => {
    const fc = toFeatureCollection([r('a', 43.5, 1.4)]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features[0].geometry.coordinates).toEqual([1.4, 43.5]);
    expect(fc.features[0].properties.id).toBe('a');
  });
});

describe('hasMovedFar', () => {
  it('vrai au-delà du seuil, faux en dessous ou sans point de départ', () => {
    expect(hasMovedFar(null, { lat: 43.6, lng: 1.44 })).toBe(true);
    expect(hasMovedFar({ lat: 43.6, lng: 1.44 }, { lat: 43.6001, lng: 1.44 })).toBe(false);
    expect(hasMovedFar({ lat: 43.6, lng: 1.44 }, { lat: 43.62, lng: 1.44 })).toBe(true);
  });
});

describe('nearbyUrl', () => {
  it('construit la requête avec les bornes attendues', () => {
    const u = new URL(nearbyUrl({ lat: 43.6, lng: 1.44 }, 2000, 50), 'http://x');
    expect(u.pathname).toBe('/api/restaurants');
    expect(u.searchParams.get('lat')).toBe('43.6');
    expect(u.searchParams.get('radius')).toBe('2000');
    expect(u.searchParams.get('limit')).toBe('50');
  });
});
