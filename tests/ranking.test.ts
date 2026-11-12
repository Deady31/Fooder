import { describe, expect, it } from 'vitest';
import { rankRichFirst, richness } from '../lib/ranking';
import type { Restaurant } from '../data/mockRestaurants';

const base: Restaurant = {
  id: 'x', name: 'X', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Restaurant', image: '',
  address: 'Toulouse', description: '',
};
const make = (id: string, extra: Partial<Restaurant> = {}): Restaurant => ({ ...base, id, name: id, ...extra });
const week = Array.from({ length: 7 }, () => [[720, 840]] as [number, number][]);

describe('richness', () => {
  it('fiche vide = 0', () => {
    expect(richness(base)).toBe(0);
  });

  it('chaque information connue augmente le score', () => {
    const r0 = richness(base);
    expect(richness(make('a', { hours: week }))).toBeGreaterThan(r0);
    expect(richness(make('a', { cuisine: 'Japonais' }))).toBeGreaterThan(r0);
    expect(richness(make('a', { website: 'https://x.fr' }))).toBeGreaterThan(r0);
    expect(richness(make('a', { image: 'https://x/p.jpg', photoSource: 'google' }))).toBeGreaterThan(r0);
    expect(richness(make('a', { address: '12 rue Alsace-Lorraine, 31000' }))).toBeGreaterThan(r0);
  });

  it('cuisines génériques comptent comme faibles', () => {
    for (const c of ['Restaurant', 'Français', 'français', 'Street & Fast', '']) {
      expect(richness(make('a', { cuisine: c }))).toBe(0);
    }
    expect(richness(make('a', { cuisine: 'Pizzeria' }))).toBeGreaterThan(0);
  });

  it('adresse de repli (quartier / Toulouse) n’est pas une vraie adresse', () => {
    expect(richness(make('a', { address: 'Quartier Arnaud-Bernard, Toulouse' }))).toBe(0);
    expect(richness(make('a', { address: 'Toulouse' }))).toBe(0);
  });

  it('horaires vides (semaine entièrement fermée) ne comptent pas', () => {
    expect(richness(make('a', { hours: Array.from({ length: 7 }, () => []) }))).toBe(0);
  });

  it('une vraie photo vaut plus qu’un plat typique', () => {
    const dish = richness(make('a', { image: 'd.jpg', photoSource: 'dish' }));
    const real = richness(make('a', { image: 'g.jpg', photoSource: 'google' }));
    expect(real).toBeGreaterThan(dish);
    expect(dish).toBeGreaterThan(0);
  });
});

describe('rankRichFirst', () => {
  const rich = (id: string) => make(id, { hours: week, cuisine: 'Italien', website: 'https://x.fr', address: '1 rue A' });
  const poor = (id: string) => make(id);

  it('pousse les fiches pauvres à la fin, sans rien supprimer', () => {
    const input = [poor('p1'), rich('r1'), poor('p2'), rich('r2')];
    const out = rankRichFirst(input);
    expect(out.map(r => r.id)).toEqual(['r1', 'r2', 'p1', 'p2']);
    expect(out).toHaveLength(input.length);
  });

  it('stable : conserve l’ordre existant (distance, personnalisation) dans chaque groupe', () => {
    const input = [rich('a'), rich('b'), rich('c'), poor('d'), poor('e')];
    expect(rankRichFirst(input).map(r => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    const shuffled = [poor('z'), rich('y'), poor('x'), rich('w')];
    expect(rankRichFirst(shuffled).map(r => r.id)).toEqual(['y', 'w', 'z', 'x']);
  });

  it('ne modifie pas le tableau d’entrée', () => {
    const input = [poor('p'), rich('r')];
    const copy = [...input];
    rankRichFirst(input);
    expect(input).toEqual(copy);
  });

  it('liste vide ou 100 % pauvre / 100 % riche inchangée', () => {
    expect(rankRichFirst([])).toEqual([]);
    const allPoor = [poor('a'), poor('b')];
    expect(rankRichFirst(allPoor)).toEqual(allPoor);
    const allRich = [rich('a'), rich('b')];
    expect(rankRichFirst(allRich)).toEqual(allRich);
  });

  it('passe 10 000 fiches sans souci', () => {
    const big = Array.from({ length: 10000 }, (_, i) => (i % 3 ? poor(`p${i}`) : rich(`r${i}`)));
    const out = rankRichFirst(big);
    expect(out).toHaveLength(10000);
    expect(new Set(out.map(r => r.id)).size).toBe(10000);
  });
});
