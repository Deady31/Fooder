import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import fallback from '../data/photos-fallback.json';
import served from '../data/photos-consented.json';
import blocklist from '../data/photo-blocklist.json';
import consent from '../data/photo-consent.json';
import { fallbackPhotoFor, type ConsentFile } from '../lib/sitePhotos';
import { photoRank, withBetterPhoto } from '../lib/photoPriority';
import type { Restaurant } from '../data/mockRestaurants';

const ROOT = path.resolve(__dirname, '..');
const table = fallback as Record<string, { src: string; classe: string }>;
const base = { id: 'x', name: 'X' } as unknown as Restaurant;

describe('photos de secours (ambiance) : vraie photo de l’établissement exact, jamais un plat générique', () => {
  it('chaque secours est le fichier de CETTE fiche, existe, et a une classe autorisée', () => {
    for (const [id, p] of Object.entries(table)) {
      expect(p.src, id).toBe(`/restos/${id}.webp`);
      expect(fs.existsSync(path.join(ROOT, 'public', p.src)), id).toBe(true);
      expect(['facade', 'interieur', 'logo'], id).toContain(p.classe);
    }
  });

  it('aucune image (octets identiques) en secours sur deux fiches, ni identique à une photo servie', () => {
    const seen = new Map<string, string>();
    const servedHashes = new Set<string>();
    for (const [id, p] of Object.entries(served as Record<string, { src?: string }>)) {
      if ((blocklist as { blocked: Record<string, unknown> }).blocked[id] || !p.src) continue;
      const f = path.join(ROOT, 'public', p.src);
      if (fs.existsSync(f)) servedHashes.add(crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'));
    }
    for (const [id, p] of Object.entries(table)) {
      const h = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'public', p.src))).digest('hex');
      expect(seen.get(h), `${id} partage son image avec ${seen.get(h)}`).toBeUndefined();
      expect(servedHashes.has(h), `${id} identique à une photo servie`).toBe(false);
      seen.set(h, id);
    }
  });

  it('le secours est le niveau le plus bas : plat, communauté et photo du site le remplacent', () => {
    expect(photoRank('ambiance')).toBeGreaterThan(0);
    expect(photoRank('ambiance')).toBeLessThan(photoRank('site'));
    const withFallback = withBetterPhoto(base, { source: 'ambiance', images: ['/restos/x.webp'] });
    expect(withFallback.photoSource).toBe('ambiance');
    for (const source of ['site', 'community', 'restaurant'] as const) {
      expect(withBetterPhoto(withFallback, { source, images: ['/y.webp'] }).photoSource).toBe(source);
    }
    expect(withBetterPhoto(withFallback, { source: 'ambiance', images: ['/z.webp'] })).toBe(withFallback);
  });

  it('fallbackPhotoFor : refuse sans accord général, après retrait, classe inconnue ou src vide', () => {
    const on: ConsentFile = { blanket: { active: true }, revoked: [] };
    const t = { a: { src: '/restos/a.webp', classe: 'facade' as const } };
    expect(fallbackPhotoFor('a', t, on)).toEqual({ src: '/restos/a.webp', classe: 'facade' });
    expect(fallbackPhotoFor('a', t, { blanket: { active: false } })).toBeNull();
    expect(fallbackPhotoFor('a', t, { ...on, revoked: ['a'] })).toBeNull();
    expect(fallbackPhotoFor('b', t, on)).toBeNull();
    expect(fallbackPhotoFor('a', { a: { src: '/x.webp', classe: 'menu' as never } }, on)).toBeNull();
    expect(fallbackPhotoFor('a', { a: { src: '', classe: 'logo' } }, on)).toBeNull();
  });

  it('les fiches retirées par le restaurateur n’ont pas de secours', () => {
    for (const id of (consent as ConsentFile).revoked ?? []) expect(table[id]).toBeUndefined();
  });
});
