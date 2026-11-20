import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import consented from '../data/photos-consented.json';
import blocklist from '../data/photo-blocklist.json';
import { CLASSES } from '../scripts/lib/photoSelect.mjs';
import { isPresentable, osmToRestaurant, type OsmRecord } from '../lib/osm';

type Entry = { src: string; kind: string; vision?: { classe: string; confiance: number } };
const table = consented as unknown as Record<string, Entry>;
const blocked = (blocklist as unknown as { blocked: Record<string, unknown> }).blocked;
const records = places as unknown as OsmRecord[];
const served = records.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
const visionFile = fs.existsSync('data/photo-vision.json') ? JSON.parse(fs.readFileSync('data/photo-vision.json', 'utf8')) : {};

describe('données réelles : fiches servies', () => {
  it('100 % ont une adresse vérifiée, jamais « Quartier X » en guise d’adresse', () => {
    expect(served.length).toBeGreaterThan(2000);
    for (const r of served) {
      const a = osmToRestaurant(r).address;
      expect(a, r.n).toBeTruthy();
      expect(a, r.n).not.toMatch(/^quartier\b/i);
    }
  });
});

describe('données réelles : photos servies', () => {
  const servedPhotos = Object.entries(table).filter(([id, p]) => !blocked[id] && p.kind !== 'dish');

  it('toute photo servie a été classée « plat » par la vision et son fichier existe', () => {
    expect(servedPhotos.length).toBeGreaterThan(200);
    for (const [id, p] of servedPhotos) {
      expect(p.vision?.classe, id).toBe('plat');
      expect(p.vision!.confiance, id).toBeGreaterThanOrEqual(0.75);
      expect(fs.existsSync(`public${p.src}`), `${id} : fichier ${p.src}`).toBe(true);
    }
  });

  it('le registre de vision ne contient que des classes connues', () => {
    for (const [key, v] of Object.entries(visionFile) as [string, { classe: string }][]) expect([...CLASSES, 'inconnu'], key).toContain(v.classe);
  });

  it('aucune fiche servie n’a une photo servie non-plat dans le registre de vision', () => {
    for (const [id] of servedPhotos) {
      for (const key of [`${id}#chk`]) {
        const v = visionFile[key] as { classe: string; verdict: string } | undefined;
        if (v) expect(v.verdict, `${id} (${v.classe})`).toBe('keep');
      }
    }
  });
});
