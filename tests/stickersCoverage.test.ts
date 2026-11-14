import { describe, expect, it } from 'vitest';
import places from '../data/toulouse-places.json';
import { cuisineLabel, isPresentable, type OsmRecord } from '../lib/osm';
import { matchSticker } from '../lib/stickers';

const records = (places as unknown as OsmRecord[]).filter(r => isPresentable(r));
const iconOf = (r: OsmRecord) => matchSticker(cuisineLabel(r), r.n);

describe('icônes sur les fiches réelles de Toulouse', () => {
  it('au moins 95 % des fiches présentables ont une icône précise', () => {
    const hit = records.filter(r => iconOf(r) !== null).length;
    expect(hit / records.length).toBeGreaterThanOrEqual(0.95);
  });

  it('reconnaît les codes de cuisine anglais d’OpenStreetMap', () => {
    expect(matchSticker('lebanese')).toBe('mezze');
    expect(matchSticker('american')).toBe('burger');
    expect(matchSticker('vegetarian')).toBe('salad');
    expect(matchSticker('fine_dining')).toBe('french');
    expect(matchSticker('teahouse')).toBe('coffee');
  });

  it('ne met jamais un dessert ou une boisson sur un lieu salé (pizza, burger, kebab…)', () => {
    const sweet = new Set(['icecream', 'cupcake', 'donut', 'waffle', 'boba', 'coffee', 'cocktail', 'beer', 'winebar']);
    const salty = records.filter(r => /pizz|burger|kebab|sushi|tacos/i.test(r.n));
    for (const r of salty) expect(sweet.has(iconOf(r) ?? '')).toBe(false);
  });

  it('donne le même résultat à chaque calcul', () => {
    for (const r of records.slice(0, 300)) expect(iconOf(r)).toBe(iconOf(r));
  });
});
