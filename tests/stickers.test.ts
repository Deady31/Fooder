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

  it('associe les icônes du lot 2', () => {
    expect(stickerFor('Poké', 'x', 'Pokawa')).toBe('poke');
    expect(stickerFor('Grec', 'x', 'Alba')).toBe('gyros');
    expect(stickerFor('Restaurant', 'x', 'Grec & co.')).toBe('gyros');
    expect(stickerFor('Falafel', 'x', '')).toBe('falafel');
    expect(stickerFor('Tex-mex', 'x', 'Fresh Burritos')).toBe('burrito');
    expect(stickerFor('Restaurant', 'x', 'Paella Casa')).toBe('paella');
    expect(stickerFor('Poulet', 'x', 'KFC')).toBe('chicken');
    expect(stickerFor('Restaurant', 'x', 'Le Biergarten')).toBe('beer');
    expect(stickerFor('Restaurant', 'x', 'Donna Bar à Cocktails')).toBe('cocktail');
    expect(stickerFor('Restaurant', 'x', 'La Cave se rebiffe')).toBe('winebar');
    expect(stickerFor('Barbecue', 'x', 'Yankee Grill')).toBe('steakhouse');
    expect(stickerFor('Gaufres', 'x', 'Waffle Factory')).toBe('waffle');
    expect(stickerFor('Restaurant', 'x', 'Madame Raclette')).toBe('fondue');
    expect(stickerFor('Tibetan', 'x', '')).toBe('momo');
    expect(stickerFor('Japonais', 'x', 'Izakaya Iori')).toBe('yakitori');
    expect(stickerFor('Restaurant', 'x', 'Tikka N’curry')).toBe('naan');
  });

  it('corrige les mauvaises associations connues', () => {
    expect(stickerFor('Japonais', 'x', 'Bo-Bun')).toBe('vietnam');
    expect(stickerFor('Restaurant', 'x', 'Bistr’O bo bun')).toBe('vietnam');
    expect(stickerFor('Poulet', 'x', 'Miss Fish')).toBe('seafood');
    expect(stickerFor('Japonais', 'x', 'Mizuki Ramen')).toBe('ramen');
    expect(stickerFor('Asiatique', 'x', 'Restaurant Phô')).toBe('vietnam');
    expect(stickerFor('Asiatique', 'x', 'Thaï Food')).toBe('thai');
    expect(stickerFor('Végétarien', 'x', 'Madame Poutine')).toBe('fries');
    expect(stickerFor('Africain', 'x', 'La Kasbah')).toBe('tagine');
    expect(stickerFor('Restaurant', 'x', 'Smash Pickleball Club')).toBe('plate');
    expect(stickerFor('Restaurant', 'x', 'Bowling de Gramont')).toBe('plate');
    expect(stickerFor('Gastropub', 'x', 'Bier Akademie')).toBe('beer');
    expect(stickerFor('Iranienne', 'x', 'La Perse')).toBe('mezze');
    expect(stickerFor('Senegal', 'x', '')).toBe('african');
  });

  it('couvre au moins 87 % des fiches réelles avec une icône spécifique', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const pool = data.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
    const hit = pool.filter(r => matchSticker(cuisineLabel(r), r.n) !== null).length;
    expect(hit / pool.length).toBeGreaterThan(0.87);
  });

  it('chaque icône attribuée à une fiche réelle a bien son fichier', () => {
    const data = JSON.parse(readFileSync('data/toulouse-places.json', 'utf8')) as OsmRecord[];
    const used = new Set(data.map(r => stickerFor(cuisineLabel(r), r.id, r.n)));
    for (const k of Array.from(used)) expect(existsSync(`public${stickerSrc(k)}`), k).toBe(true);
  });
});
