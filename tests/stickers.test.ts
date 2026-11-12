import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { FOOD_STICKERS, matchSticker, satellitesFor, stickerFor, stickerSrc } from '../lib/stickers';
import { OsmRecord, cuisineLabel, isPresentable } from '../lib/osm';

describe('icônes de restaurants', () => {
  it('associe les cuisines aux icônes les plus proches', () => {
    expect(stickerFor('Libanais', 'x', 'Beyrouth')).toBe('mezze');
    expect(stickerFor('Vietnamien', 'x', '')).toBe('vietnam');
    expect(stickerFor('Chinois', 'x', '')).toBe('chinese');
    expect(stickerFor('Japonais', 'x', '')).toBe('sushi');
    expect(stickerFor('Marocain', 'x', '')).toBe('tagine');
    expect(stickerFor('Coréen', 'x', '')).toBe('korean');
    expect(stickerFor('Indien', 'x', '')).toBe('curry');
    expect(stickerFor('Crêperie', 'x', '')).toBe('crepe');
    expect(stickerFor('Italien', 'x', 'Chez Marco')).toBe('pasta');
    expect(stickerFor('Thaï', 'x', '')).toBe('thai');
    expect(stickerFor('Africain', 'x', '')).toBe('african');
    expect(stickerFor('Couscous', 'x', '')).toBe('couscous');
    expect(stickerFor('Terroir', 'x', '')).toBe('cassoulet');
    expect(stickerFor('Français', 'x', 'Chez Marcel')).toBe('french');
    expect(stickerFor('Français', 'x', 'Le Bistrot')).toBe('bistro');
    expect(stickerFor('Poissons', 'x', '')).toBe('seafood');
    expect(stickerFor('Tapas', 'x', '')).toBe('tapas');
    expect(stickerFor('Sandwich', 'x', '')).toBe('sandwich');
  });

  it('un restaurant libanais n’obtient jamais un donut, une pita seule ou une icône sucrée', () => {
    for (const n of ['Beyrouth', 'Chez Karim', 'Le Cèdre', '']) {
      expect(stickerFor('Libanais', 'x', n)).toBe('mezze');
    }
    expect(['donut', 'cupcake', 'icecream', 'boba']).not.toContain(stickerFor('Libanais', 'x', 'Donut Palace'));
  });

  it('tous les fichiers d’icônes référencés existent', () => {
    for (const k of FOOD_STICKERS) {
      expect(existsSync(`public${stickerSrc(k)}`), k).toBe(true);
    }
  });

  it('les satellites de couverture sont stables et de la même famille', () => {
    expect(satellitesFor('mezze')).toEqual(satellitesFor('mezze'));
    expect(satellitesFor('mezze')).toContain('kebab');
    expect(satellitesFor('thai')).not.toContain('donut');
  });

  it('un nom explicite l’emporte sur une cuisine générique', () => {
    expect(stickerFor('Italien', 'x', 'Pizzeria Roma')).toBe('pizza');
    expect(stickerFor('Restaurant', 'x', 'Le Palais du Kebab')).toBe('kebab');
  });

  it('retrouve la cuisine par le nom quand elle est inconnue', () => {
    expect(stickerFor('Restaurant', 'x', 'Pho Saigon')).toBe('vietnam');
    expect(stickerFor('Restaurant', 'x', 'Trattoria da Luigi')).toBe('pasta');
    expect(stickerFor('Restaurant', 'x', 'Tajine d’Or')).toBe('tagine');
  });

  it('ne choisit jamais une icône au hasard : inconnu = assiette neutre, stable', () => {
    expect(stickerFor('Restaurant', 'a', 'Chez Marcel')).toBe('plate');
    expect(stickerFor('Restaurant', 'b', 'Chez Marcel')).toBe('plate');
    expect(stickerFor('Restaurant', 'c', 'Le Bistrot Marcel')).not.toBe('donut');
  });

  it('ne met jamais une icône sucrée ou une boisson sur un lieu salé', () => {
    const sweet = new Set(['donut', 'cupcake', 'icecream', 'boba', 'coffee']);
    for (const c of ['Libanais', 'Vietnamien', 'Français', 'Restaurant', 'Marocain', 'Terroir', 'Africain', 'Coréen', 'Thaï', 'Italien']) {
      expect(sweet.has(stickerFor(c, 'x', 'Chez Marcel'))).toBe(false);
    }
  });

  it('couvre au moins 85 % des fiches réelles avec une icône spécifique', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const hit = pool.filter(r => matchSticker(cuisineLabel(r), r.n) !== null).length;
    expect(hit / pool.length).toBeGreaterThan(0.85);
  });
});
