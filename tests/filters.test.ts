import { describe, expect, it } from 'vitest';
import { applyFilters, blockingFilter, dietsFromProfile, earliestReopening, sinkClosed, toggleDiet, FILTER_DIETS } from '../lib/filters';
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
    const open = [a, c, d];
    const out = applyFilters(open, { openNow: false, diets: [], now: NOON });
    expect(out).toEqual(open);
    expect(out).not.toBe(open);
  });

  it('ouvert maintenant : exclut fermes et horaires inconnus', () => {
    const noHours = mk('e');
    const out = applyFilters([...list, noHours], { openNow: true, diets: [], now: NOON });
    expect(out.map(r => r.id)).toEqual(['a', 'c', 'd']);
  });

  it('regime : exclut les fiches sans info, ET logique, ordre stable', () => {
    expect(applyFilters(list, { openNow: false, diets: ['vegetarian'], now: NOON, hideClosed: false }).map(r => r.id)).toEqual(['a', 'd', 'b']);
    expect(applyFilters(list, { openNow: false, diets: ['vegan', 'halal'], now: NOON, hideClosed: false }).map(r => r.id)).toEqual(['d']);
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
    expect(applyFilters(mockRestaurants, { openNow: false, diets: [], now: NOON, hideClosed: false })).toHaveLength(mockRestaurants.length);
  });

  it('ne modifie pas la liste d entree', () => {
    const copy = [...list];
    applyFilters(list, { openNow: true, diets: ['vegan'], now: NOON });
    expect(list).toEqual(copy);
  });
});

describe('applyFilters : rayon autour de la position', () => {
  // Capitole ; ~550 m plus au sud (Carmes) ; ~3,3 km (Rangueil) ; sans coordonnées.
  const origin = { lat: 43.6045, lng: 1.4442 };
  const near = mk('near', { lat: 43.6045, lng: 1.4452 }); // ~80 m
  const mid = mk('mid', { lat: 43.5995, lng: 1.4455 }); // ~560 m
  const far = mk('far', { lat: 43.5755, lng: 1.4620 }); // ~3,5 km
  const nowhere = mk('nowhere');
  const geo = [near, mid, far, nowhere];

  it('garde seulement les restos dans le rayon (haversine), ordre conserve', () => {
    expect(applyFilters(geo, { openNow: false, diets: [], now: NOON, hideClosed: false, origin, radiusM: 500 }).map(r => r.id)).toEqual(['near']);
    expect(applyFilters(geo, { openNow: false, diets: [], now: NOON, origin, radiusM: 1000 }).map(r => r.id)).toEqual(['near', 'mid']);
    expect(applyFilters(geo, { openNow: false, diets: [], now: NOON, origin, radiusM: 5000 }).map(r => r.id)).toEqual(['near', 'mid', 'far']);
  });

  it('rayon null (toute la metropole) ou sans origine : aucun filtre de distance', () => {
    expect(applyFilters(geo, { openNow: false, diets: [], now: NOON, origin, radiusM: null })).toHaveLength(4);
    expect(applyFilters(geo, { openNow: false, diets: [], now: NOON, origin: null, radiusM: 500 })).toHaveLength(4);
  });

  it('fiche sans coordonnees exclue quand un rayon est actif', () => {
    expect(applyFilters([nowhere], { openNow: false, diets: [], now: NOON, origin, radiusM: 10000 })).toEqual([]);
  });

  it('se combine avec ouvert maintenant et les regimes', () => {
    const vegNearOpen = mk('v1', { lat: 43.6046, lng: 1.4443, hours: OPEN_HOURS as never, diets: ['vegan'] });
    const vegNearClosed = mk('v2', { lat: 43.6046, lng: 1.4443, hours: CLOSED_HOURS as never, diets: ['vegan'] });
    const vegFarOpen = mk('v3', { lat: 43.5755, lng: 1.462, hours: OPEN_HOURS as never, diets: ['vegan'] });
    const out = applyFilters([vegNearOpen, vegNearClosed, vegFarOpen, near], {
      openNow: true, diets: ['vegan'], now: NOON, origin, radiusM: 2000,
    });
    expect(out.map(r => r.id)).toEqual(['v1']);
  });
});

describe('applyFilters : budget et cuisine (non destructifs)', () => {
  const cheap = mk('cheap', { price: 12, cuisine: 'Pizzeria' });
  const pricey = mk('pricey', { price: 90, cuisine: 'Gastronomique' });
  const unknown = mk('unknown', { price: 0, cuisine: 'Pizzeria' });

  it('budget max : prix connus au-dessus exclus, prix inconnu garde', () => {
    expect(applyFilters([cheap, pricey, unknown], { openNow: false, diets: [], now: NOON, maxPrice: 40 }).map(r => r.id)).toEqual(['cheap', 'unknown']);
    expect(applyFilters([cheap, pricey, unknown], { openNow: false, diets: [], now: NOON, maxPrice: null })).toHaveLength(3);
  });

  it('cuisine exacte ; null = toutes', () => {
    expect(applyFilters([cheap, pricey, unknown], { openNow: false, diets: [], now: NOON, cuisine: 'Pizzeria' }).map(r => r.id)).toEqual(['cheap', 'unknown']);
    expect(applyFilters([cheap, pricey, unknown], { openNow: false, diets: [], now: NOON, cuisine: null })).toHaveLength(3);
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

describe('blockingFilter : quel filtre vide la pile', () => {
  const origin = { lat: 43.6045, lng: 1.4442 };
  const farVeg = mk('fv', { lat: 43.5755, lng: 1.462, hours: OPEN_HOURS as never, diets: ['vegan'] });
  const nearMeat = mk('nm', { lat: 43.6046, lng: 1.4443, hours: CLOSED_HOURS as never });
  const base = { openNow: false, diets: [] as never[], now: NOON, hideClosed: false, origin, radiusM: 500 };

  it('le rayon en premier s il suffit a debloquer', () => {
    expect(blockingFilter([farVeg], base)).toBe('radius');
  });
  it('sinon le regime, puis ouvert maintenant, puis budget/cuisine', () => {
    expect(blockingFilter([nearMeat], { ...base, diets: ['vegan'] })).toBe('diets');
    expect(blockingFilter([nearMeat], { ...base, openNow: true })).toBe('openNow');
    expect(blockingFilter([nearMeat], { ...base, cuisine: 'Thaï' })).toBe('price');
  });
});

describe('applyFilters : restaurants fermés (hideClosed, défaut true)', () => {
  const base = { openNow: false, diets: [] as never[], now: NOON };
  const soon = mk('soon', { hours: 'Mo-Su 09:00-12:20' as never }); // ferme dans 20 min
  const notYetSoon = mk('later', { hours: 'Mo-Su 09:00-12:30' as never }); // exactement 30 min : pas « bientôt »
  const unknown = mk('unknown');

  it('par défaut : fermé retiré, horaires inconnus gardés', () => {
    expect(applyFilters([a, b, unknown, c], base).map(r => r.id)).toEqual(['a', 'unknown', 'c']);
  });

  it('bientôt fermé (< 30 min) passe après les autres, ordre relatif conservé', () => {
    expect(applyFilters([soon, a, unknown, notYetSoon, c], base).map(r => r.id)).toEqual(['a', 'unknown', 'later', 'c', 'soon']);
  });

  it('« fermés inclus » : tout reste, fermés en toute fin', () => {
    expect(applyFilters([b, soon, a, unknown], { ...base, hideClosed: false }).map(r => r.id)).toEqual(['a', 'unknown', 'soon', 'b']);
  });

  it('« Ouvert (confirmé) » exclut inconnus et fermés, même avec fermés inclus', () => {
    expect(applyFilters([a, b, unknown], { ...base, openNow: true, hideClosed: false }).map(r => r.id)).toEqual(['a']);
  });

  it('combiné au rayon et aux régimes', () => {
    const origin = { lat: 43.6045, lng: 1.4442 };
    const near = { lat: 43.6046, lng: 1.4443 };
    const far = { lat: 43.5755, lng: 1.462 };
    const veganNearOpen = mk('vno', { ...near, hours: OPEN_HOURS as never, diets: ['vegan'] });
    const veganNearClosed = mk('vnc', { ...near, hours: CLOSED_HOURS as never, diets: ['vegan'] });
    const veganNearUnknown = mk('vnu', { ...near, diets: ['vegan'] });
    const veganFarOpen = mk('vfo', { ...far, hours: OPEN_HOURS as never, diets: ['vegan'] });
    const meatNearOpen = mk('mno', { ...near, hours: OPEN_HOURS as never });
    const all = [veganNearOpen, veganNearClosed, veganNearUnknown, veganFarOpen, meatNearOpen];
    const o = { ...base, diets: ['vegan' as const], origin, radiusM: 2000 };
    expect(applyFilters(all, o).map(r => r.id)).toEqual(['vno', 'vnu']);
    expect(applyFilters(all, { ...o, hideClosed: false }).map(r => r.id)).toEqual(['vno', 'vnu', 'vnc']);
  });

  it('l’heure est celle de Paris, quel que soit le fuseau de l’appareil', () => {
    // 2026-11-11T23:30Z = jeudi 00:30 Paris : « 19:00-23:00 » et « 09:00-18:00 » sont fermés.
    const night = new Date('2026-11-11T23:30:00Z');
    expect(applyFilters([a, b], { ...base, now: night })).toEqual([]);
  });

  it('ne modifie pas la liste d’entrée', () => {
    const input = [b, soon, a];
    applyFilters(input, base);
    expect(input.map(r => r.id)).toEqual(['b', 'soon', 'a']);
  });
});

describe('sinkClosed (ordre de la pile : dernière carte = dessus)', () => {
  const soon = mk('soon', { hours: 'Mo-Su 09:00-12:20' as never });
  it('place bientôt fermé et fermés tout en bas (début), sans toucher aux cartes protégées', () => {
    expect(sinkClosed([a, soon, c, b], NOON, new Set()).map(r => r.id)).toEqual(['b', 'soon', 'a', 'c']);
    expect(sinkClosed([a, c, soon], NOON, new Set(['soon'])).map(r => r.id)).toEqual(['a', 'c', 'soon']);
  });
});

describe('earliestReopening', () => {
  it('le resto qui rouvre le plus tôt, avec le délai', () => {
    const night = new Date('2026-11-11T23:00:00Z'); // jeudi 00:00 Paris
    const lunch = mk('lunch', { name: 'Chez Midi', hours: 'Mo-Su 12:00-14:00' as never });
    const early = mk('early', { name: 'Chez Tôt', hours: 'Mo-Su 07:30-10:00' as never });
    const unknown = mk('unk');
    const res = earliestReopening([lunch, unknown, early], night);
    expect(res?.rest.id).toBe('early');
    expect(res?.opening).toEqual({ minutes: 450, dayOffset: 0, time: '07:30' });
  });
  it('aucun horaire connu : null', () => {
    expect(earliestReopening([mk('u')], NOON)).toBeNull();
    expect(earliestReopening([], NOON)).toBeNull();
  });
});

describe('blockingFilter : tout est fermé', () => {
  const night = new Date('2026-11-11T23:30:00Z');
  const closed = mk('c1', { hours: OPEN_HOURS as never });
  it('« closed » quand seuls des fermés correspondent aux autres filtres', () => {
    expect(blockingFilter([closed], { openNow: false, diets: [], now: night })).toBe('closed');
  });
  it('pas « closed » si afficher les fermés ne change rien', () => {
    expect(blockingFilter([closed], { openNow: false, diets: ['vegan'], now: night })).toBe('diets');
  });
});
