import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import places from '../data/toulouse-places.json';
import { PROTEIN_LABEL } from '../lib/categories';
import { cuisineLabel, isPresentable, isProteinFirst, type OsmRecord } from '../lib/osm';
import { matchSticker, stickerFor } from '../lib/stickers';

const all = places as unknown as OsmRecord[];
const byId = (id: string) => all.find(r => r.id === id) as OsmRecord;
const rec = (n: string, c = ''): OsmRecord => ({ id: 'x', n, c, k: 'fast_food', la: 43.6, ln: 1.44, a: '', h: '', w: '', d: 0 });

describe('catégorie « Protéines »', () => {
  it('a un libellé stable (utilisé par le filtre et par l’API)', () => {
    expect(PROTEIN_LABEL).toBe('Protéines');
  });

  it('classe les restos protéine d’abord, vus dans les données de Toulouse', () => {
    const ids: Record<string, string> = {
      'Good Protein': 'osm-n12828437770',
      'Protéine Eat (burger)': 'osm-n13811339337',
      'Proteine Eat': 'osm-n12623529107',
      'Crousty One': 'osm-n2450406603',
      SoCrousty: 'osm-n2459885356',
      'Tasty Crousty': 'osm-n2444345516',
      'Krousty Sabaïdi': 'osm-n2458144342',
      'Rôtisserie Rio': 'osm-w1208655924',
      'La Rotisserie (Muret)': 'osm-w81402399',
      'Rôtisserie Tournefeuille': 'ovt-3611f6a6-95b3-4a4e',
      Wingstop: 'osm-n2554000382',
      KFC: 'osm-n467781044',
      'Poulet Show': 'osm-n2439030954',
    };
    for (const [label, id] of Object.entries(ids)) {
      const r = byId(id);
      expect(r, `${label} absent des données`).toBeTruthy();
      expect(isProteinFirst(r), label).toBe(true);
      expect(cuisineLabel(r), label).toBe(PROTEIN_LABEL);
    }
  });

  it('ne range pas à tort : tacos, grills, steakhouses, « Croustille », pubs à wings, cuisines précises', () => {
    expect(isProteinFirst(byId('osm-n1775087915'))).toBe(false); // O'Tacos
    expect(isProteinFirst(byId('osm-n2460954145'))).toBe(false); // Chicken Tacos 31
    expect(isProteinFirst(byId('osm-n365269997'))).toBe(false); // Buffalo Grill
    expect(isProteinFirst(byId('osm-n775985755'))).toBe(false); // Hippopotamus
    expect(isProteinFirst(byId('osm-n13369358438'))).toBe(false); // Croustille
    expect(isProteinFirst(byId('osm-n1215767137'))).toBe(false); // Pub O'Clock (wings en 4e étiquette)
    expect(isProteinFirst(rec('Pattaya thaï street food and hot wings', 'thai'))).toBe(false);
    expect(isProteinFirst(rec('Coq d’Or', 'moroccan'))).toBe(false);
    expect(isProteinFirst(rec('Bella Pizza Chicken', 'pizza'))).toBe(false);
  });

  it('accepte « chicken » seul dans le nom sans autre cuisine précise', () => {
    expect(isProteinFirst(rec('Chicken Street'))).toBe(true);
    expect(isProteinFirst(rec('Chicken Cook', 'burger'))).toBe(true);
  });

  it('donne l’icône poulet à la catégorie (illustration, jamais une photo générique)', () => {
    expect(matchSticker(PROTEIN_LABEL, '')).toBe('chicken');
    expect(stickerFor(PROTEIN_LABEL, 'x', 'Good Protein')).toBe('chicken');
  });

  it('garde un volume plausible sur les vraies données (ni vide, ni envahissant)', () => {
    const n = all.filter(isProteinFirst).length;
    const shown = all.filter(r => isPresentable(r) && isProteinFirst(r)).length;
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(130);
    expect(shown).toBeGreaterThanOrEqual(30);
  });
});

describe('GET /api/restaurants?cuisine=Protéines', () => {
  const call = async (qs: string) => {
    const { GET } = await import('../app/api/restaurants/route');
    const res = await GET(new NextRequest(`http://localhost/api/restaurants?${qs}`, { headers: { 'x-forwarded-for': '10.9.9.9' } }));
    return res.json() as Promise<{ success: boolean; data: { id: string; cuisine: string; distanceMeters: number }[]; meta: { total: number } }>;
  };

  it('ne renvoie que la catégorie demandée, dans le rayon', async () => {
    const json = await call(`cuisine=${encodeURIComponent(PROTEIN_LABEL)}&radius=20000&limit=50`);
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(30);
    expect(json.data.every(r => r.cuisine === PROTEIN_LABEL)).toBe(true);
    expect(json.data.every(r => r.distanceMeters <= 20000)).toBe(true);
  });

  it('sans paramètre, le comportement est inchangé (toutes les catégories)', async () => {
    const json = await call('radius=3000&limit=50');
    expect(new Set(json.data.map(r => r.cuisine)).size).toBeGreaterThan(3);
  });
});

import { FEATURED_CUISINES, PIZZA_LABEL, currentCuisineLabel, defaultCuisineList, matchesCuisineQuery } from '../lib/categories';

describe('recherche de cuisine dans les filtres', () => {
  it('trouve par morceau de mot, sans accents ni majuscules', () => {
    expect(matchesCuisineQuery('Protéines', 'PROTE')).toBe(true);
    expect(matchesCuisineQuery('Végétarien', 'vege')).toBe(true);
    expect(matchesCuisineQuery('Japonais', 'sushi')).toBe(true);
    expect(matchesCuisineQuery('Burger', 'sushi')).toBe(false);
    expect(matchesCuisineQuery('Burger', '   ')).toBe(true);
  });
  it('« pizza » trouve Pizza et « poulet » trouve Protéines', () => {
    expect(matchesCuisineQuery(PIZZA_LABEL, 'pizza')).toBe(true);
    expect(matchesCuisineQuery(PIZZA_LABEL, 'pizzeria')).toBe(true);
    expect(matchesCuisineQuery(PROTEIN_LABEL, 'poulet')).toBe(true);
    expect(matchesCuisineQuery(PROTEIN_LABEL, 'crousty')).toBe(true);
  });
  it('propose Protéines et Pizza en tête, puis les plus fréquentes, 24 au plus', () => {
    const catalog = Array.from({ length: 60 }, (_, i) => ({ label: `Cuisine ${String(i).padStart(2, '0')}`, count: 100 - i }));
    const list = defaultCuisineList([...catalog, { label: PIZZA_LABEL, count: 1 }], null);
    expect(list.slice(0, 2)).toEqual([...FEATURED_CUISINES]);
    expect(list.length).toBe(24);
    expect(list).toContain('Cuisine 00');
    expect(list).not.toContain('Cuisine 59');
  });
  it('garde la catégorie choisie visible, une seule fois', () => {
    const list = defaultCuisineList([{ label: 'Thaï', count: 3 }], 'Pizza');
    expect(list.filter(l => l === 'Pizza').length).toBe(1);
    expect(list[0]).toBe('Pizza');
  });
  it('convertit l’ancien libellé « Pizzeria » mémorisé dans le navigateur', () => {
    expect(currentCuisineLabel('Pizzeria')).toBe('Pizza');
    expect(currentCuisineLabel('Thaï')).toBe('Thaï');
  });
  it('les vraies fiches de pizza sont toutes sous « Pizza »', () => {
    const labels = new Set(all.filter(r => (r.c ?? '').split(';')[0] === 'pizza' || (r.c ?? '').split(';')[0] === 'italian_pizza').map(r => cuisineLabel(r)));
    expect(labels.has('Pizzeria')).toBe(false);
    expect(labels.has(PIZZA_LABEL)).toBe(true);
  });
});

describe('GET /api/cuisines', () => {
  it('liste les catégories avec leur nombre de fiches, dont Pizza et Protéines', async () => {
    const { GET } = await import('../app/api/cuisines/route');
    const json = (await GET().json()) as { success: boolean; data: { label: string; count: number }[] };
    expect(json.success).toBe(true);
    const by = new Map(json.data.map(c => [c.label, c.count]));
    expect(by.get(PIZZA_LABEL)).toBeGreaterThan(100);
    expect(by.get(PROTEIN_LABEL)).toBeGreaterThan(30);
    expect(by.has('Pizzeria')).toBe(false);
  });
});
