import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { matchSticker, stickerFor } from '../lib/stickers';
import { OsmRecord, cuisineLabel, isPresentable } from '../lib/osm';

describe('icônes de restaurants', () => {
  it('associe les cuisines aux icônes les plus proches', () => {
    expect(stickerFor('Libanais', 'x', 'Beyrouth')).toBe('kebab');
    expect(stickerFor('Vietnamien', 'x', '')).toBe('ramen');
    expect(stickerFor('Chinois', 'x', '')).toBe('dumpling');
    expect(stickerFor('Japonais', 'x', '')).toBe('sushi');
    expect(stickerFor('Marocain', 'x', '')).toBe('curry');
    expect(stickerFor('Coréen', 'x', '')).toBe('ramen');
    expect(stickerFor('Indien', 'x', '')).toBe('curry');
    expect(stickerFor('Crêperie', 'x', '')).toBe('brunch');
    expect(stickerFor('Italien', 'x', 'Chez Marco')).toBe('pasta');
  });

  it('un nom explicite l’emporte sur une cuisine générique', () => {
    expect(stickerFor('Italien', 'x', 'Pizzeria Roma')).toBe('pizza');
    expect(stickerFor('Restaurant', 'x', 'Le Palais du Kebab')).toBe('kebab');
  });

  it('retrouve la cuisine par le nom quand elle est inconnue', () => {
    expect(stickerFor('Restaurant', 'x', 'Pho Saigon')).toBe('ramen');
    expect(stickerFor('Restaurant', 'x', 'Trattoria da Luigi')).toBe('pasta');
    expect(stickerFor('Restaurant', 'x', 'Tajine d’Or')).toBe('curry');
  });

  it('ne choisit jamais une icône au hasard : inconnu = assiette neutre, stable', () => {
    expect(stickerFor('Restaurant', 'a', 'Chez Marcel')).toBe('plate');
    expect(stickerFor('Restaurant', 'b', 'Chez Marcel')).toBe('plate');
    expect(stickerFor('Français', 'c', 'Le Bistrot')).toBe('plate');
  });

  it('ne met jamais une icône sucrée ou une boisson sur un lieu salé', () => {
    const sweet = new Set(['donut', 'cupcake', 'icecream', 'boba', 'coffee']);
    for (const c of ['Libanais', 'Vietnamien', 'Français', 'Restaurant', 'Marocain', 'Terroir', 'Africain', 'Coréen', 'Thaï', 'Italien']) {
      expect(sweet.has(stickerFor(c, 'x', 'Chez Marcel'))).toBe(false);
    }
  });

  it('couvre au moins 60 % des fiches réelles avec une icône spécifique', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const hit = pool.filter(r => matchSticker(cuisineLabel(r), r.n) !== null).length;
    expect(hit / pool.length).toBeGreaterThan(0.6);
  });
});
