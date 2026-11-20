import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import type { Restaurant } from '../data/mockRestaurants';
import { BUFFET_ENTRIES, BUFFET_IDS, BUFFET_MOOD, isBuffet } from '../lib/buffets';
import { buildApiQuery, matchesMood, moodPool } from '../lib/deckLoader';
import { isPresentable, osmToRestaurant, type OsmRecord } from '../lib/osm';

const records = places as unknown as OsmRecord[];
const byId = new Map(records.map(r => [r.id, r]));
const resto = (id: string, buffet?: boolean): Restaurant => ({ id, name: id, cuisine: 'Asiatique', rating: 0, price: 0, distance: '', image: '', address: '', description: '', ...(buffet ? { buffet } : {}) });

describe('liste des buffets à volonté', () => {
  it('chaque entrée avec identifiant existe dans la base des lieux', () => {
    for (const e of BUFFET_ENTRIES.filter(x => x.id)) expect(byId.has(e.id as string), `${e.name} (${e.id})`).toBe(true);
  });

  it('pas de doublon d’identifiant', () => {
    const ids = BUFFET_ENTRIES.filter(e => e.id).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque entrée est datée et sourcée par des liens https', () => {
    for (const e of BUFFET_ENTRIES) {
      expect(e.verifiedAt, e.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.sources.length, e.name).toBeGreaterThanOrEqual(1);
      for (const s of e.sources) expect(s, e.name).toMatch(/^https:\/\//);
    }
  });

  it('un buffet confirmé a un identifiant et au moins deux sources', () => {
    for (const e of BUFFET_ENTRIES.filter(x => x.status === 'confirmed')) {
      expect(e.id, e.name).toBeTruthy();
      expect(e.sources.length, e.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('à confirmer et exclus ont une raison et ne sont jamais marqués buffet', () => {
    for (const e of BUFFET_ENTRIES.filter(x => x.status !== 'confirmed')) {
      expect(e.reason, e.name).toBeTruthy();
      if (e.id) expect(isBuffet(e.id), e.name).toBe(false);
    }
  });

  it('au moins 8 buffets confirmés sont affichables (fiche présentable avec horaires)', () => {
    const visible = Array.from(BUFFET_IDS).filter(id => {
      const r = byId.get(id);
      return r !== undefined && isPresentable(r);
    });
    expect(visible.length).toBeGreaterThanOrEqual(8);
  });

  it('la fiche d’un buffet confirmé porte le drapeau buffet, pas celle des autres', () => {
    const first = Array.from(BUFFET_IDS)[0];
    expect(osmToRestaurant(byId.get(first) as OsmRecord).buffet).toBe(true);
    const other = records.find(r => !BUFFET_IDS.has(r.id)) as OsmRecord;
    expect(osmToRestaurant(other).buffet).toBeUndefined();
  });
});

describe('envie « Buffet à volonté »', () => {
  it('ne garde que les buffets', () => {
    expect(matchesMood(resto('a', true), BUFFET_MOOD)).toBe(true);
    expect(matchesMood(resto('b'), BUFFET_MOOD)).toBe(false);
  });

  it('jamais de repli sur tous les restos quand il n’y a aucun buffet', () => {
    expect(moodPool([resto('a'), resto('b')], BUFFET_MOOD)).toEqual([]);
    expect(moodPool([resto('a'), resto('b', true)], BUFFET_MOOD).map(r => r.id)).toEqual(['b']);
  });

  it('les autres envies gardent leur repli', () => {
    expect(moodPool([resto('a')], 'street')).toHaveLength(1);
  });

  it('demande à l’API les seuls buffets quand il le faut', () => {
    expect(new URLSearchParams(buildApiQuery(null, 0, null, true)).get('buffet')).toBe('1');
    expect(new URLSearchParams(buildApiQuery(null, 0)).has('buffet')).toBe(false);
  });
});
