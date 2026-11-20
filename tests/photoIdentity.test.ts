import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import places from '../data/toulouse-places.json';
import manifest from '../data/photos-consented.json';
import blocklist from '../data/photo-blocklist.json';
import { osmToRestaurant, type OsmRecord } from '../lib/osm';
import { restaurantPhoto } from '../lib/sitePhotos';
import { fetchPlacePhoto } from '../lib/google/placePhotos';
import { fetchGooglePhotos } from '../lib/placePhotosClient';
import { FoodImage } from '../components/ui/FoodImage';

/**
 * Identité des photos : une image ne s'affiche que sur la fiche de l'établissement EXACT.
 * Sans photo vérifiée : aucune image, la carte montre l'illustration Fooder. Jamais une photo « de la cuisine ».
 */
// Les composants du dépôt utilisent le JSX « classique » dans vitest : React doit être global.
(globalThis as { React?: unknown }).React = React;
const ROOT = path.resolve(__dirname, '..');
const all = places as unknown as OsmRecord[];
const cards = (re: RegExp) => all.filter(r => re.test(r.n)).map(r => osmToRestaurant(r));
const GENERIC_SOURCES = /\/dishes\/|unsplash|pexels|pixabay|wikimedia|images\.google/i;

describe('aucune photo générique sur une carte de restaurant', () => {
  it.each([
    ['KFC', /^KFC$/],
    ['McDonald’s', /^McDonald/i],
    ['Burger King', /^Burger King$/],
    ['pizzerias', /pizz/i],
    ['tacos', /tacos/i],
  ])('%s : image vide ou photo propre à la fiche, jamais une photo de la cuisine', (_label, re) => {
    const list = cards(re);
    expect(list.length).toBeGreaterThan(3);
    for (const r of list) {
      expect(r.image === '' || r.image === `/restos/${r.id}.webp`, `${r.name} (${r.id}) : ${r.image}`).toBe(true);
      expect(r.image).not.toMatch(GENERIC_SOURCES);
      expect(r.photoSource === undefined || r.photoSource === 'site' || r.photoSource === 'restaurant').toBe(true);
    }
  });

  it('KFC : toutes les fiches de la chaîne sans photo vérifiée n’ont AUCUNE image (placeholder)', () => {
    const kfc = cards(/^KFC$/);
    expect(kfc.length).toBeGreaterThan(5);
    expect(kfc.every(r => r.image === '')).toBe(true);
  });
});

describe('provenance : la photo d’une fiche est celle de cette fiche', () => {
  const entries = Object.entries(manifest as Record<string, { src: string; page?: string }>);
  const blocked = (blocklist as { blocked: Record<string, unknown> }).blocked;
  const shown = entries.filter(([id]) => restaurantPhoto(id) !== null);

  it('le fichier servi porte l’identifiant de la fiche (jamais l’image d’un autre établissement)', () => {
    expect(shown.length).toBeGreaterThan(300);
    for (const [id, p] of shown) expect(p.src).toBe(`/restos/${id}.webp`);
  });

  it('aucune image (octets identiques) n’est affichée sur deux fiches : visuel de marque, d’hébergeur ou de chaîne', () => {
    const seen = new Map<string, string>();
    for (const [id, p] of shown) {
      const file = path.join(ROOT, 'public', p.src);
      if (!fs.existsSync(file)) continue;
      const h = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
      expect(seen.get(h), `${id} partage son image avec ${seen.get(h)}`).toBeUndefined();
      seen.set(h, id);
    }
  });

  it('aucune page source n’est rattachée à deux fiches affichées', () => {
    const seen = new Map<string, string>();
    for (const [id, p] of shown) {
      const page = (p.page ?? '').toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '');
      if (!page) continue;
      expect(seen.get(page), `${id} et ${seen.get(page)} partagent ${page}`).toBeUndefined();
      seen.set(page, id);
    }
  });

  it('les photos partagées sont bien écartées (liste de blocage) et n’apparaissent plus', () => {
    const autoShared = Object.entries(blocked).filter(([, e]) => (e as { source?: string }).source === 'auto-shared');
    expect(autoShared.length).toBeGreaterThan(100);
    for (const [id] of autoShared) expect(restaurantPhoto(id)).toBeNull();
  });
});

describe('photo absente : placeholder Fooder', () => {
  it('sans src, FoodImage rend l’illustration Fooder (role=img), jamais un <img> de photo', () => {
    const html = renderToStaticMarkup(createElement(FoodImage, { src: '', alt: 'KFC Toulouse Purpan', cuisine: 'Protéines' }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="KFC Toulouse Purpan"');
    expect(html).not.toMatch(GENERIC_SOURCES);
    expect(html).not.toContain('/restos/');
  });
});

describe('Google Places : jamais de recherche générique, jamais de photo sans identification exacte', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ours = { name: 'KFC', lat: 43.6, lng: 1.4 };

  it('une erreur API ne déclenche aucune autre requête que Google Places (pas de recherche d’image générique)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(String(u)); throw new Error('réseau coupé'); }));
    const out = await fetchPlacePhoto(ours, 'clé-de-test', { allowPaidCall: () => true });
    expect(out.status).toBe('none');
    expect(urls.length).toBe(1);
    expect(urls.every(u => u.startsWith('https://places.googleapis.com/'))).toBe(true);
  });

  it('établissement ambigu ou à plus de 150 m : aucune photo demandée (pas d’appel média)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      urls.push(String(u));
      return new Response(JSON.stringify({ places: [
        { id: 'ChIJkfc000001', displayName: { text: 'KFC' }, location: { latitude: 43.6003, longitude: 1.4 } },
        { id: 'ChIJkfc000002', displayName: { text: 'KFC' }, location: { latitude: 43.6004, longitude: 1.4 } },
        { id: 'ChIJkfc000003', displayName: { text: 'KFC' }, location: { latitude: 43.62, longitude: 1.42 } },
      ] }), { status: 200 });
    }));
    const out = await fetchPlacePhoto(ours, 'clé-de-test', { allowPaidCall: () => true });
    expect(out.status).toBe('none');
    expect(urls.some(u => u.includes('/media'))).toBe(false);
  });

  it('une photo de l’établissement A n’est jamais attribuée à l’établissement B (cache et réponses asynchrones indexés par fiche)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const name = new URL(u, 'http://x').searchParams.get('name') ?? '';
      const slow = name === 'Resto A';
      await new Promise(r => setTimeout(r, slow ? 40 : 1));
      return new Response(JSON.stringify({ success: true, placeId: `ChIJ${name.replace(/\W/g, '')}0000`, data: [{ url: `https://photos.example/${encodeURIComponent(name)}.jpg`, author: 'x' }] }), { status: 200 });
    }));
    const [a, b] = await Promise.all([
      fetchGooglePhotos({ id: 'osm-nA', name: 'Resto A', lat: 43.6, lng: 1.4 }),
      fetchGooglePhotos({ id: 'osm-nB', name: 'Resto B', lat: 43.61, lng: 1.41 }),
    ]);
    expect(a[0].url).toContain('Resto%20A');
    expect(b[0].url).toContain('Resto%20B');
    expect((await fetchGooglePhotos({ id: 'osm-nA', name: 'Resto A', lat: 43.6, lng: 1.4 }))[0].url).toContain('Resto%20A');
  });
});

describe('anciens providers d’images génériques neutralisés', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const sources = ['app', 'components', 'lib', 'hooks'].flatMap(d => walk(path.join(ROOT, d)));
  const FORBIDDEN: [string, RegExp][] = [
    ['banque d’images (Unsplash, Pexels, Pixabay)', /unsplash|pexels|pixabay/i],
    ['recherche Google Images', /images\.google|google\.com\/search\?.*tbm=isch|customsearch/i],
    ['photos Wikimedia « plat typique »', /upload\.wikimedia|commons\.wikimedia|photoSource:\s*'dish'|source:\s*'dish'|from '[./]*lib\/dishes'|from '\.\/dishes'/],
    ['génération d’image par IA', /dall-?e|stability\.ai|midjourney|images\/generations/i],
  ];

  it.each(FORBIDDEN)('aucun appel ni import : %s', (_label, re) => {
    for (const f of sources) expect(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f)).not.toMatch(re);
  });

  it('le module et le dossier des photos génériques n’existent plus', () => {
    expect(fs.existsSync(path.join(ROOT, 'lib/dishes.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'public/dishes'))).toBe(false);
  });

  it('la source « dish » (plat typique) n’est plus une source de carte', async () => {
    const { PHOTO_PRIORITY } = await import('../lib/photoPriority');
    expect([...PHOTO_PRIORITY]).not.toContain('dish');
  });
});

describe('coût zéro : Google éteint par défaut', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete process.env.GOOGLE_PLACES_API_KEY; delete process.env.GOOGLE_PHOTOS_ENABLED; });

  const call = async () => {
    const { GET } = await import('../app/api/place-photos/route');
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest('http://localhost/api/place-photos?name=KFC&lat=43.6&lng=1.44', { headers: { 'x-forwarded-for': '10.1.1.1' } }));
    return res.json() as Promise<{ data: unknown[]; reason?: string }>;
  };

  it('clé présente mais interrupteur absent : aucun appel réseau, aucune photo', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'clé-de-test';
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    vi.resetModules();
    const json = await call();
    expect(json.data).toEqual([]);
    expect(json.reason).toBe('disabled');
    expect(spy).not.toHaveBeenCalled();
  });

  it('interrupteur sans clé : toujours éteint', async () => {
    process.env.GOOGLE_PHOTOS_ENABLED = '1';
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    vi.resetModules();
    expect((await call()).reason).toBe('disabled');
    expect(spy).not.toHaveBeenCalled();
  });
});
