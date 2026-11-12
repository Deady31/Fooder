import { describe, expect, it } from 'vitest';
import { applyFilters, dietsFromProfile, toggleDiet, FILTER_DIETS } from '../lib/filters';
import { mockRestaurants } from '../data/mockRestaurants';
import type { Restaurant } from '../data/mockRestaurants';

// Mercredi 2026-11-11 12:00 Paris (UTC+1) : ouvert 09:00-18:00, fermé la nuit.
const NOON = new Date('2026-11-11T11:00:00Z');
const OPEN_HOURS = 'Mo-Su 09:00-18:00';
const CLOSED_HOURS = 'Mo-Su 19:00-23:00';

const mk = (id: string, extra: Partial<Restaurant> = {}): Restaurant =>
  ({ id, name: id, cuisine: 'x', price: 10, rating: 4, distance: '1 km', description: '', image: '', ...extra }) as Restaurant;

const a = mk('a', { hours: OPEN_HOURS as never, diets: ['vegetarian'] });
const b = mk('b', { hours: CLOSED_HOURS as never, diets: ['vegan', 'vegetarian'] });
const c = mk('c', { hours: OPEN_HOURS as never });
const d = mk('d', { hours: OPEN_HOURS as never, diets: ['vegan', 'vegetarian', 'halal'] });
const list = [a, b, c, d];

describe('applyFilters', () => {
  it('sans filtre : tout passe, ordre conserve, nouvelle liste', () => {
    const out = applyFilters(list, { openNow: false, diets: [], now: NOON });
    expect(out).toEqual(list);
    expect(out).not.toBe(list);
  });

  it('ouvert maintenant : exclut fermes et horaires inconnus', () => {
    const noHours = mk('e');
    const out = applyFilters([...list, noHours], { openNow: true, diets: [], now: NOON });
    expect(out.map(r => r.id)).toEqual(['a', 'c', 'd']);
  });

  it('regime : exclut les fiches sans info, ET logique, ordre stable', () => {
    expect(applyFilters(list, { openNow: false, diets: ['vegetarian'], now: NOON }).map(r => r.id)).toEqual(['a', 'b', 'd']);
    expect(applyFilters(list, { openNow: false, diets: ['vegan', 'halal'], now: NOON }).map(r => r.id)).toEqual(['d']);
  });

  it('combine ouvert maintenant et regime', () => {
    expect(applyFilters(list, { openNow: true, diets: ['vegan'], now: NOON }).map(r => r.id)).toEqual(['d']);
  });

  it('cas vides', () => {
    expect(applyFilters([], { openNow: true, diets: ['vegan'], now: NOON })).toEqual([]);
    expect(applyFilters(list, { openNow: false, diets: ['halal', 'vegan', 'gluten_free'], now: NOON })).toEqual([]);
  });

  it('fiches mock (sans info de regime) exclues quand un regime est demande', () => {
    expect(mockRestaurants.length).toBeGreaterThan(0);
    expect(applyFilters(mockRestaurants, { openNow: false, diets: ['vegetarian'], now: NOON }).filter(r => !r.diets)).toEqual([]);
    expect(applyFilters(mockRestaurants, { openNow: false, diets: [], now: NOON })).toHaveLength(mockRestaurants.length);
  });

  it('ne modifie pas la liste d entree', () => {
    const copy = [...list];
    applyFilters(list, { openNow: true, diets: ['vegan'], now: NOON });
    expect(list).toEqual(copy);
  });
});

describe('toggleDiet', () => {
  it('ajoute puis retire sans muter', () => {
    const base: ('vegan')[] = [];
    expect(toggleDiet(base, 'vegan')).toEqual(['vegan']);
    expect(base).toEqual([]);
    expect(toggleDiet(['vegan', 'halal'], 'vegan')).toEqual(['halal']);
  });
});

describe('dietsFromProfile', () => {
  it('lit les regimes valides du profil', () => {
    expect(dietsFromProfile('{"diets":["vegan","halal","bidon","gluten_free"]}')).toEqual(['vegan', 'halal']);
  });
  it('tolere null, JSON invalide, mauvais types', () => {
    expect(dietsFromProfile(null)).toEqual([]);
    expect(dietsFromProfile('{oups')).toEqual([]);
    expect(dietsFromProfile('{"diets":"vegan"}')).toEqual([]);
    expect(dietsFromProfile('42')).toEqual([]);
    expect(dietsFromProfile('null')).toEqual([]);
  });
  it('dedoublonne', () => {
    expect(dietsFromProfile('{"diets":["vegan","vegan"]}')).toEqual(['vegan']);
  });
});

describe('FILTER_DIETS', () => {
  it('pas de sans gluten', () => {
    expect(FILTER_DIETS).toEqual(['vegetarian', 'vegan', 'halal']);
  });
});
