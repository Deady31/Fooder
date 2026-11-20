import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import overlay from '../data/addresses-verified.json';
import geo from '../data/quartiers-toulouse.json';
import { verifiedAddress, type VerifiedAddress } from '../lib/addresses';
import { isPresentable, osmToRestaurant, type OsmRecord } from '../lib/osm';
import { QUARTIERS, QUARTIER_NAMES } from '../lib/quartiers';
import { GEO_QUARTIER_NAMES, QUARTIER_SOURCE, pointInRings, quartierAt } from '../lib/quartiersGeo';

const table = overlay as unknown as Record<string, VerifiedAddress>;
const records = places as unknown as OsmRecord[];
const cityOf = (a: string): string => (a.split(',').pop() ?? '').trim().toLowerCase();

describe('quartiers : liste et contours', () => {
  it('60 quartiers officiels, sans doublon, liste du navigateur identique aux contours', () => {
    expect(QUARTIER_NAMES).toHaveLength(60);
    expect(new Set(QUARTIER_NAMES).size).toBe(60);
    expect([...QUARTIER_NAMES].sort()).toEqual([...GEO_QUARTIER_NAMES].sort());
    expect(QUARTIERS.map(q => q.name)).toEqual([...QUARTIER_NAMES]);
  });

  it('les contours sont bien formés : anneaux fermés, au moins 4 points, boîte englobante exacte, dans l’agglomération', () => {
    for (const q of geo.quartiers) {
      const outer = q.rings[0] as number[][];
      expect(outer.length, q.name).toBeGreaterThanOrEqual(4);
      for (const ring of q.rings as number[][][]) expect(ring[0], q.name).toEqual(ring[ring.length - 1]);
      const lats = outer.map(p => p[0]);
      const lngs = outer.map(p => p[1]);
      expect(q.bbox, q.name).toEqual([Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)]);
      expect(q.bbox[0], q.name).toBeGreaterThan(43.4);
      expect(q.bbox[2], q.name).toBeLessThan(43.8);
    }
  });

  it('la source et la licence sont citées dans les données', () => {
    expect(QUARTIER_SOURCE.licence).toContain('Licence Ouverte');
    expect(QUARTIER_SOURCE.source).toContain('Mairie de Toulouse');
    expect(QUARTIER_SOURCE.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('les quartiers ne se chevauchent pas (3 000 points tirés dans la ville : jamais dans deux contours)', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let overlaps = 0;
    for (let i = 0; i < 3000; i++) {
      const lat = 43.52 + rnd() * 0.15;
      const lng = 1.33 + rnd() * 0.19;
      const hits = geo.quartiers.filter(q => pointInRings(lat, lng, q.rings as unknown as [number, number][][])).length;
      if (hits > 1) overlaps++;
    }
    expect(overlaps).toBe(0);
  });
});

describe('quartiers : point dans polygone', () => {
  it('point dans un carré, hors du carré, et dans un trou', () => {
    const square: [number, number][] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    const hole: [number, number][] = [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]];
    expect(pointInRings(5, 5, [square])).toBe(true);
    expect(pointInRings(11, 5, [square])).toBe(false);
    expect(pointInRings(5, 5, [square, hole])).toBe(false);
    expect(pointInRings(2, 5, [square, hole])).toBe(true);
  });

  it('lieux connus de Toulouse', () => {
    expect(quartierAt(43.6045, 1.4442)).toBe('Capitole'); // place du Capitole
    expect(quartierAt(43.5993, 1.4308)).toBe('Saint-Cyprien'); // place Saint-Cyprien
    expect(quartierAt(43.5999, 1.4455)).toBe('Carmes'); // place des Carmes
    expect(quartierAt(43.6082, 1.4418)).toBe('Arnaud Bernard'); // basilique Saint-Sernin
  });

  it('hors de Toulouse : rien (jamais le quartier le plus proche)', () => {
    expect(quartierAt(43.637, 1.39)).toBeNull(); // Blagnac
    expect(quartierAt(43.611, 1.334)).toBeNull(); // Colomiers
    expect(quartierAt(43.543, 1.51)).toBeNull(); // Labège
    expect(quartierAt(43.2, 1.4)).toBeNull();
    expect(quartierAt(Number.NaN, 1.4)).toBeNull();
  });
});

describe('quartiers : cohérence avec les fiches servies', () => {
  const served = records.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));

  it('une fiche à adresse vérifiée dans Toulouse a son quartier, aucune autre n’en a un', () => {
    expect(served.length).toBeGreaterThan(1000);
    for (const r of served) {
      const a = verifiedAddress(r.id) as string;
      const q = table[r.id].q;
      if (cityOf(a) === 'toulouse') expect(q, `${r.n} (${a})`).toBeTruthy();
      else expect(q, `${r.n} (${a})`).toBeNull();
    }
  });

  it('le quartier servi vient de la surcouche et nourrit la description ; rien sans quartier', () => {
    const withQ = served.find(r => table[r.id].q) as OsmRecord;
    const card = osmToRestaurant(withQ);
    expect(card.quartier).toBe(table[withQ.id].q);
    expect(card.description).toContain(`quartier ${card.quartier}`);
    const without = served.find(r => !table[r.id].q) as OsmRecord;
    const plain = osmToRestaurant(without);
    expect(plain.quartier).toBeUndefined();
    expect(plain.description).not.toContain('quartier');
  });

  it('cas témoin Tasty Crousty : deux agences, deux quartiers officiels différents', () => {
    const capitole = table['osm-n2444345516'];
    const muret = table['osm-n14140901448'];
    expect(capitole.q).toBe('Arnaud Bernard');
    expect(muret.q).toBe('Croix-de-Pierre');
    expect(capitole.q).not.toBe(muret.q);
  });
});
