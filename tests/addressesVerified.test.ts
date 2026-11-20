import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import overlay from '../data/addresses-verified.json';
import { verifiedAddress, verifiedEntry, type VerifiedAddress } from '../lib/addresses';
import { isPresentable, isPresentableBase, osmToRestaurant, type OsmRecord } from '../lib/osm';

const records = places as unknown as OsmRecord[];
const byId = new Map(records.map(r => [r.id, r]));
const table = overlay as unknown as Record<string, VerifiedAddress>;
const entries = Object.entries(table);
const served = records.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));

describe('adresses vérifiées : intégrité de la surcouche', () => {
  it('chaque entrée correspond à une fiche existante, avec un statut et une source', () => {
    for (const [id, e] of entries) {
      expect(byId.has(id), id).toBe(true);
      expect(['ok', 'approx', 'none']).toContain(e.av);
      expect(e.src.length, id).toBeGreaterThan(0);
    }
  });

  it('une adresse « ok » est complète : numéro ou rue, code postal à 5 chiffres, commune', () => {
    for (const [id, e] of entries.filter(([, x]) => x.av === 'ok')) {
      expect(e.a, id).toBeTruthy();
      expect(e.a, id).toMatch(/\b\d{5}\b/);
      expect((e.a as string).split(',').length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('aucune adresse « Quartier … » dans la surcouche, et rien d’affiché pour « none » et « approx »', () => {
    for (const [id, e] of entries) {
      if (e.a) expect(e.a, id).not.toMatch(/^Quartier\b/i);
      if (e.av !== 'ok') expect(verifiedAddress(id), id).toBeNull();
    }
  });

  it('un doublon pointe vers une fiche dont l’adresse est validée', () => {
    for (const [id, e] of entries.filter(([, x]) => x.dup)) {
      expect(table[e.dup as string]?.av, id).toBe('ok');
      expect(table[e.dup as string]?.dup, id).toBeUndefined();
      expect(verifiedAddress(id), id).toBeNull();
    }
  });

  it('la surcouche est triée et stable (relancer le script ne change rien au diff)', () => {
    const ids = entries.map(([id]) => id);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : 1)));
  });
});

describe('adresses vérifiées : barrière de mise en production', () => {
  it('toute fiche servie par l’API a une adresse vérifiée', () => {
    expect(served.length).toBeGreaterThan(1000);
    for (const r of served) expect(verifiedAddress(r.id), r.id).not.toBeNull();
  });

  it('aucune adresse servie ne vient d’un repli « Quartier X, Toulouse » et aucune n’est vide', () => {
    for (const r of served) {
      const a = osmToRestaurant(r).address;
      expect(a, r.id).toBeTruthy();
      expect(a, r.id).not.toMatch(/^Quartier\b/i);
      expect(a, r.id).toBe(verifiedAddress(r.id));
    }
  });

  it('une fiche sans adresse vérifiée n’est pas servie, même si elle a tout le reste', () => {
    const noAddr = records.filter(r => isPresentableBase(r) && verifiedAddress(r.id) === null);
    expect(noAddr.length).toBeGreaterThan(0);
    for (const r of noAddr) expect(isPresentable(r), r.id).toBe(false);
  });

  it('la fiche brute n’est jamais affichée : une adresse OSM non validée ne sort pas', () => {
    const raw = records.find(r => r.a && verifiedEntry(r.id) && verifiedEntry(r.id)?.av !== 'ok');
    if (raw) expect(osmToRestaurant(raw).address).toBe('');
  });
});

describe('adresses vérifiées : cas témoins', () => {
  it('Tasty Crousty et Crousty One : jamais servis sans adresse vérifiée, jamais avec l’adresse d’un autre lieu', () => {
    const ids = ['osm-n2444345516', 'osm-n14140901448', 'osm-n2450406603'];
    const addresses = new Set<string>();
    for (const id of ids) {
      const rec = byId.get(id) as OsmRecord;
      expect(rec, id).toBeDefined();
      if (isPresentable(rec)) {
        const a = verifiedAddress(id) as string;
        expect(a, id).toBeTruthy();
        // Deux agences distinctes (~2,9 km) ne peuvent pas partager la même adresse.
        expect(addresses.has(a), `${id} partage l'adresse ${a}`).toBe(false);
        addresses.add(a);
      } else {
        expect(verifiedAddress(id)).toBeNull();
      }
    }
  });
});

const cacheOk = fs.existsSync(path.join(process.cwd(), 'data', 'cache', 'ban.json'));
describe('adresses vérifiées : idempotence du script', () => {
  it.skipIf(!cacheOk)('relancer la décision hors ligne redonne exactement la même surcouche', () => {
    const file = path.join(process.cwd(), 'data', 'addresses-verified.json');
    const before = fs.readFileSync(file, 'utf8');
    execFileSync(process.execPath, ['scripts/verify-addresses.mjs', '--offline', '--phase=decide'], { cwd: process.cwd(), stdio: 'ignore' });
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});
