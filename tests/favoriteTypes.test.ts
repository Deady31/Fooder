import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import type { Restaurant } from '../data/mockRestaurants';
import { BUFFET_IDS } from '../lib/buffets';
import { FAMILIES, countFamilies, familiesOf, familyLabel, filterByFamily, parseFamily } from '../lib/favoriteTypes';
import { cuisineLabel, isPresentable, type OsmRecord } from '../lib/osm';
import { FOOD_STICKERS } from '../lib/stickers';

const resto = (id: string, cuisine: string, name = id): Restaurant => ({ id, name, cuisine, rating: 0, price: 0, distance: '', image: '', address: '', description: '' });

describe('types de restaurant des coups de cœur', () => {
  it('classe les cuisines courantes dans la bonne famille', () => {
    expect(familiesOf(resto('a', 'Japonais'))).toEqual(['asie']);
    expect(familiesOf(resto('b', 'Burger'))).toEqual(['street']);
    expect(familiesOf(resto('c', 'Pizzeria'))).toEqual(['pizza']);
    expect(familiesOf(resto('d', 'Français'))).toEqual(['terroir']);
    expect(familiesOf(resto('e', 'Libanais'))).toEqual(['orient']);
    expect(familiesOf(resto('f', 'Café'))).toEqual(['cafe']);
  });

  it('une cuisine inconnue tombe dans « Autres », jamais dans une famille au hasard', () => {
    expect(familiesOf(resto('x', ''))).toEqual(['autre']);
    expect(familiesOf(resto('y', 'Restaurant'))).toEqual(['autre']);
  });

  it('un buffet à volonté a sa cuisine ET la famille « buffet »', () => {
    const royal = resto(Array.from(BUFFET_IDS)[0], 'Asiatique');
    expect(familiesOf(royal)).toEqual(['asie', 'buffet']);
  });

  it('chaque icône de plat a une famille (aucun trou)', () => {
    for (const s of FOOD_STICKERS) {
      const r = familiesOf({ id: 'z', name: 'z', cuisine: s });
      expect(r.length, s).toBeGreaterThanOrEqual(1);
    }
  });

  it('compte les familles, la plus fréquente d’abord, et ignore celles sans resto', () => {
    const list = [resto('1', 'Burger'), resto('2', 'Burger'), resto('3', 'Japonais'), resto('4', 'Pizzeria'), resto('5', 'Pizzeria'), resto('6', 'Pizzeria')];
    const counts = countFamilies(list).map(x => `${x.family.id}:${x.count}`);
    expect(counts).toEqual(['pizza:3', 'street:2', 'asie:1']);
    expect(countFamilies([])).toEqual([]);
  });

  it('en cas d’égalité, garde l’ordre d’affichage prévu', () => {
    const list = [resto('1', 'Pizzeria'), resto('2', 'Japonais')];
    expect(countFamilies(list).map(x => x.family.id)).toEqual(['asie', 'pizza']);
  });

  it('filtre par famille, ou rend toute la liste sans filtre', () => {
    const list = [resto('1', 'Burger'), resto('2', 'Japonais'), resto('3', 'Burger')];
    expect(filterByFamily(list, 'street').map(r => r.id)).toEqual(['1', '3']);
    expect(filterByFamily(list, null)).toEqual(list);
    expect(filterByFamily(list, 'bar')).toEqual([]);
  });

  it('le filtre ne modifie jamais la liste d’origine', () => {
    const list = [resto('1', 'Burger'), resto('2', 'Japonais')];
    const copy = [...list];
    const out = filterByFamily(list, null);
    out.pop();
    expect(list).toEqual(copy);
  });

  it('lit un identifiant de famille de l’adresse sans se laisser tromper', () => {
    expect(parseFamily('asie')).toBe('asie');
    expect(parseFamily('buffet')).toBe('buffet');
    for (const bad of [null, undefined, 42, 'inconnu', '', 'ASIE', ['asie']]) expect(parseFamily(bad), String(bad)).toBeNull();
  });

  it('chaque famille a un libellé et une icône', () => {
    for (const f of FAMILIES) {
      expect(familyLabel(f.id)).toBe(f.label);
      expect(f.label.length).toBeGreaterThan(0);
    }
    expect(new Set(FAMILIES.map(f => f.id)).size).toBe(FAMILIES.length);
  });

  it('sur les vrais restos de Toulouse, moins de 10 % tombent dans « Autres »', () => {
    const records = (places as unknown as OsmRecord[]).filter(r => isPresentable(r));
    const autre = records.filter(r => familiesOf({ id: r.id, name: r.n, cuisine: cuisineLabel(r) }).includes('autre')).length;
    expect(autre / records.length).toBeLessThan(0.1);
  });
});
