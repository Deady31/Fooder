import { describe, expect, it } from 'vitest';
import { parseOpeningHours } from '../lib/openingHours';
import { completeness, cuisineLabel, formatMeters, haversine, isPresentable, normalizePhone, osmToRestaurant, OsmRecord } from '../lib/osm';
import { openStatus } from '../lib/hours';
import { AVATARS, isUnlocked, lockReason } from '../lib/avatars';

describe('parseOpeningHours', () => {
  it('lit plusieurs plages et un jour fermé', () => {
    const w = parseOpeningHours('Mo-Sa 12:00-14:00,19:00-22:30; Su off');
    expect(w).toBeDefined();
    expect(w![0]).toEqual([[720, 840], [1140, 1350]]);
    expect(w![5]).toEqual([[720, 840], [1140, 1350]]);
    expect(w![6]).toEqual([]);
  });

  it('gère la fermeture après minuit', () => {
    const w = parseOpeningHours('Fr 18:00-02:00');
    expect(w![4]).toEqual([[1080, 1560]]);
  });

  it('gère 24/7', () => {
    expect(parseOpeningHours('24/7')![3]).toEqual([[0, 1440]]);
  });

  it('refuse les syntaxes inconnues plutôt que d’inventer des horaires', () => {
    expect(parseOpeningHours('sunrise-sunset')).toBeUndefined();
    expect(parseOpeningHours('Mo-Fr 12:00-14:00 "sur rendez-vous"')).toBeUndefined();
    expect(parseOpeningHours('')).toBeUndefined();
  });

  it('alimente openStatus', () => {
    const w = parseOpeningHours('Mo-Fr 12:00-14:00')!;
    const monday1pm = new Date(2026, 10, 9, 13, 0); // lundi 9 nov. 2026
    expect(openStatus(w, monday1pm).open).toBe(true);
    const monday3pm = new Date(2026, 10, 9, 15, 0);
    expect(openStatus(w, monday3pm).open).toBe(false);
  });
});

describe('osm', () => {
  const rec: OsmRecord = { id: 'osm-n1', n: 'Chez Test', k: 'restaurant', c: 'pizza;italian', la: 43.6045, ln: 1.4442, a: '1 rue X', h: 'Mo-Su 12:00-14:00', w: '', d: 0 };

  it('calcule une distance plausible', () => {
    const d = haversine(43.6045, 1.4442, 43.6145, 1.4442);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });

  it('formate les distances', () => {
    expect(formatMeters(84)).toBe('80 m');
    expect(formatMeters(1250)).toBe('1,3 km');
  });

  it('traduit la cuisine', () => {
    expect(cuisineLabel(rec)).toBe('Pizzeria');
    expect(cuisineLabel({ c: '', k: 'fast_food', d: 0 })).toBe('Street & Fast');
    expect(cuisineLabel({ c: '', k: 'restaurant', d: 1 })).toBe('Végétarien');
  });

  it('n’invente ni note ni prix, et signale la photo comme illustration', () => {
    const r = osmToRestaurant(rec, { lat: 43.6045, lng: 1.4442 });
    expect(r.rating).toBe(0);
    expect(r.price).toBe(0);
    expect(r.image).toBe('/dishes/pizza.webp');
    expect(r.photoSource).toBe('dish');
    expect(r.dataSource).toBe('osm');
    expect(r.hours).toBeDefined();
  });
});

describe('qualité des fiches', () => {
  const base: OsmRecord = { id: 'x', n: 'N', k: 'restaurant', c: '', la: 43.6, ln: 1.44, a: '', h: '', w: '', d: 0 };

  it('refuse une fiche sans information utile', () => {
    expect(isPresentable(base)).toBe(false);
    expect(isPresentable({ ...base, a: '1 rue X' })).toBe(false);
  });

  it('accepte cuisine + adresse + téléphone, ou horaires + adresse', () => {
    expect(isPresentable({ ...base, c: 'pizza', a: '1 rue X', t: '+33561000000' })).toBe(true);
    expect(isPresentable({ ...base, h: 'Mo-Su 12:00-14:00', a: '1 rue X' })).toBe(true);
  });

  it('classe les fiches riches avant les pauvres', () => {
    expect(completeness({ ...base, c: 'pizza', w: 'https://x.fr' })).toBeGreaterThan(completeness({ ...base, c: 'pizza' }));
  });

  it('normalise les numéros français', () => {
    expect(normalizePhone('05 61 00 00 00')).toBe('+33561000000');
    expect(normalizePhone('33624655430')).toBe('+33624655430');
    expect(normalizePhone('+33 5 61 00 00 00')).toBe('+33561000000');
    expect(normalizePhone('abc')).toBeUndefined();
  });
});

describe('avatars', () => {
  it('verrouille selon le niveau uniquement', () => {
    const ramen = AVATARS.find(a => a.id === 'ramen')!;
    const hotdog = AVATARS.find(a => a.id === 'hotdog')!;
    expect(isUnlocked(ramen, 1)).toBe(false);
    expect(lockReason(ramen, 1)).toBe('Niv. 3');
    expect(isUnlocked(ramen, 3)).toBe(true);
    expect(lockReason(ramen, 3)).toBeNull();
    expect(isUnlocked(hotdog, 9)).toBe(false);
    expect(lockReason(hotdog, 9)).toBe('Niv. 10');
    expect(isUnlocked(hotdog, 10)).toBe(true);
  });
});
