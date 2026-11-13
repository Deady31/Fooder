import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { DISH_KEYS, allDishPhotos, dishKeyFor, dishPhoto, dishPhotoFor, dishVariants } from '../lib/dishes';
import { OsmRecord, cuisineLabel, isPresentable, osmToRestaurant } from '../lib/osm';

describe('photos de plats typiques', () => {
  it('chaque photo existe, est sous licence libre et crédite son auteur', () => {
    expect(DISH_KEYS.length).toBeGreaterThanOrEqual(110);
    for (const d of allDishPhotos()) {
      expect(existsSync('public' + d.src), d.key).toBe(true);
      expect(d.license, d.key).toMatch(/^(CC0|Public domain|CC BY(-SA)? [\d.]+)/);
      expect(d.author.length, d.key).toBeGreaterThan(1);
      expect(d.author, d.key).not.toMatch(/machine-readable/i);
      expect(d.page, d.key).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('associe les cuisines au bon plat', () => {
    expect(dishKeyFor('Libanais', 'Beyrouth')).toBe('lebanese');
    expect(dishKeyFor('Vietnamien', 'X')).toBe('pho');
    expect(dishKeyFor('Japonais', 'X')).toBe('sushi');
    expect(dishKeyFor('Marocain', 'X')).toBe('moroccan');
    expect(dishKeyFor('Coréen', 'X')).toBe('korean');
    expect(dishKeyFor('Italien', 'Pizzeria Roma')).toBe('pizza');
    expect(dishKeyFor('Italien', 'Chez Marco')).toBe('pasta');
    expect(dishKeyFor('Crêperie', 'X')).toBe('crepe');
    expect(dishKeyFor('Restaurant', 'Pho Saigon')).toBe('pho');
  });

  it('ne force jamais une photo quand on ne sait pas', () => {
    expect(dishKeyFor('Restaurant', 'Chez Marcel')).toBeNull();
    expect(dishKeyFor('Du monde', 'Le Globe')).toBeNull();
    expect(dishPhoto('inconnu')).toBeNull();
  });

  it('la fiche porte la photo, son auteur et sa licence', () => {
    const rec: OsmRecord = { id: 'osm-n1', n: 'Beyrouth', k: 'restaurant', c: 'lebanese', la: 43.6045, ln: 1.4442, a: '1 rue X', h: '', w: '', d: 0 };
    const r = osmToRestaurant(rec);
    expect(r.photoSource).toBe('dish');
    expect(r.image).toMatch(/^\/dishes\/(lebanese|kebab)[a-z_]*\.webp$/);
    expect(r.image).toBe(dishPhotoFor('Libanais', 'Beyrouth', rec.id)!.src);
    expect(r.photoCredit).toBeTruthy();
    expect(r.photoLicense).toBeTruthy();
    expect(r.photoPage).toMatch(/^https:\/\//);
  });

  it('les photos sont uniques (aucun fichier ni page en double)', () => {
    const all = allDishPhotos();
    expect(new Set(all.map(d => d.src)).size).toBe(all.length);
    expect(new Set(all.map(d => d.page)).size).toBe(all.length);
  });

  it('le choix de la photo est déterministe selon l’id du resto', () => {
    for (const id of ['osm-n1', 'osm-w42', 'osm-r7', 'abc']) {
      const a = dishPhotoFor('Pizzeria', 'X', id);
      expect(a).not.toBeNull();
      for (let i = 0; i < 5; i++) expect(dishPhotoFor('Pizzeria', 'X', id)!.key).toBe(a!.key);
    }
    expect(dishPhotoFor('Pizzeria', 'X')!.key).toBe('pizza');
    expect(dishPhotoFor('Restaurant', 'Chez Marcel', 'osm-n1')).toBeNull();
  });

  it('les cuisines fréquentes ont 3 à 5 assiettes différentes et le nom explicite l’emporte', () => {
    for (const k of ['pizza', 'french', 'burger', 'sushi', 'wok', 'pasta', 'kebab', 'tacos', 'steak', 'indian', 'thai', 'chinese']) {
      const n = dishVariants(k).length;
      expect(n, k).toBeGreaterThanOrEqual(3);
      expect(n, k).toBeLessThanOrEqual(7);
    }
    expect(dishKeyFor('Italien', 'Pizzeria Roma')).toBe('pizza');
    expect(dishKeyFor('Régional', 'Le Cassoulet')).toBe('terroir_cassoulet');
    expect(dishKeyFor('Vietnamien', 'Banh Mi 31')).toBe('pho_banhmi');
  });

  it('couvre la grande majorité des fiches réelles (84,7 % avant l’ajout des variantes)', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const hit = pool.filter(r => dishKeyFor(cuisineLabel(r), r.n) !== null).length;
    expect(hit / pool.length).toBeGreaterThanOrEqual(0.84);
  });

  it('montre au moins 3 photos différentes sur les cuisines les plus fréquentes des vraies données', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const byKey = new Map<string, Set<string>>();
    for (const r of pool) {
      const k = dishKeyFor(cuisineLabel(r), r.n);
      if (k) byKey.set(k, (byKey.get(k) ?? new Set()).add(dishPhotoFor(cuisineLabel(r), r.n, r.id)!.key));
    }
    for (const k of ['pizza', 'french', 'burger', 'sushi', 'pasta']) expect(byKey.get(k)!.size, k).toBeGreaterThanOrEqual(3);
  });
});
