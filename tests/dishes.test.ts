import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { DISH_KEYS, allDishPhotos, dishKeyFor, dishPhoto } from '../lib/dishes';
import { OsmRecord, cuisineLabel, isPresentable, osmToRestaurant } from '../lib/osm';

describe('photos de plats typiques', () => {
  it('chaque photo existe, est sous licence libre et crédite son auteur', () => {
    expect(DISH_KEYS.length).toBeGreaterThanOrEqual(45);
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
    expect(r.image).toBe('/dishes/lebanese.webp');
    expect(r.photoCredit).toBeTruthy();
    expect(r.photoLicense).toBeTruthy();
    expect(r.photoPage).toMatch(/^https:\/\//);
  });

  it('couvre la grande majorité des fiches réelles', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const hit = pool.filter(r => dishKeyFor(cuisineLabel(r), r.n) !== null).length;
    expect(hit / pool.length).toBeGreaterThan(0.7);
  });
});
