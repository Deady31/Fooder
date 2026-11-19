import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import places from '../data/toulouse-places.json';
import { PROTEIN_LABEL } from '../lib/categories';
import { cuisineLabel, isPresentable, isProteinFirst, type OsmRecord } from '../lib/osm';
import { matchSticker, stickerFor } from '../lib/stickers';
import { dishPhotoFor } from '../lib/dishes';

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

  it('donne l’icône poulet et une photo de plat typique à la catégorie', () => {
    expect(matchSticker(PROTEIN_LABEL, '')).toBe('chicken');
    expect(stickerFor(PROTEIN_LABEL, 'x', 'Good Protein')).toBe('chicken');
    expect(dishPhotoFor(PROTEIN_LABEL, 'Good Protein', 'osm-n12828437770')).not.toBeNull();
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
