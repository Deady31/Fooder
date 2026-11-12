import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import { DIETS, DIET_LABEL, DIET_SHORT_LABEL, DIET_SOURCE_NOTE, badgeDiets, matchesDiets } from '../lib/diets';
import { OsmRecord, osmToRestaurant } from '../lib/osm';

const base: OsmRecord = { id: 'osm-n1', n: 'Chez Test', k: 'restaurant', c: 'french', la: 43.6, ln: 1.44, a: '', h: '', w: '', d: 0 };

describe('osmToRestaurant diets', () => {
  it('expose dt sous forme de diets', () => {
    expect(osmToRestaurant({ ...base, dt: ['vegan', 'vegetarian'] }).diets).toEqual(['vegan', 'vegetarian']);
  });
  it('ne met rien quand dt est absent ou vide', () => {
    expect(osmToRestaurant(base).diets).toBeUndefined();
    expect(osmToRestaurant({ ...base, dt: [] }).diets).toBeUndefined();
  });
});

describe('matchesDiets', () => {
  const r = { diets: ['vegan', 'vegetarian'] as const };
  it('exige toutes les valeurs demandées', () => {
    expect(matchesDiets({ diets: [...r.diets] }, ['vegan'])).toBe(true);
    expect(matchesDiets({ diets: [...r.diets] }, ['vegan', 'halal'])).toBe(false);
  });
  it('liste vide = tout passe ; sans diets = rien ne passe', () => {
    expect(matchesDiets({}, [])).toBe(true);
    expect(matchesDiets({}, ['halal'])).toBe(false);
  });
});

describe('badgeDiets', () => {
  it('vegan masque végétarien, ordre stable, vide si aucune info', () => {
    expect(badgeDiets({ diets: ['vegetarian', 'vegan'] })).toEqual(['vegan']);
    expect(badgeDiets({ diets: ['halal', 'vegetarian', 'gluten_free'] })).toEqual(['vegetarian', 'halal', 'gluten_free']);
    expect(badgeDiets({})).toEqual([]);
  });
  it('libellés courts', () => {
    expect(DIET_SHORT_LABEL.vegetarian).toBe('Végé');
  });
});

describe('libellés', () => {
  it('sont en français', () => {
    expect(DIET_LABEL).toEqual({ vegan: 'Vegan', vegetarian: 'Végétarien', halal: 'Halal', gluten_free: 'Sans gluten' });
    expect(DIET_SOURCE_NOTE).toBe('selon OpenStreetMap');
  });
});

describe('jeu de données', () => {
  const recs = places as unknown as OsmRecord[];
  it('tous les dt sont dans la liste autorisée, sans doublon, vegan => vegetarian', () => {
    const withDt = recs.filter(r => r.dt);
    expect(withDt.length).toBeGreaterThan(0);
    for (const r of withDt) {
      expect(r.dt!.length).toBeGreaterThan(0);
      for (const d of r.dt!) expect(DIETS).toContain(d);
      expect(new Set(r.dt).size).toBe(r.dt!.length);
      if (r.dt!.includes('vegan')) expect(r.dt).toContain('vegetarian');
    }
  });
});
