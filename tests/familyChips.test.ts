import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { FamilyChips } from '../components/favorites/FamilyChips';
import { countFamilies } from '../lib/favoriteTypes';

// Le transformateur de test compile le JSX en React.createElement : React doit être global.
(globalThis as { React?: unknown }).React = React;

const resto = (id: string, cuisine: string): Restaurant => ({ id, name: id, cuisine, rating: 0, price: 0, distance: '', image: '', address: '', description: '' });
const noop = () => undefined;

describe('puces de type de resto', () => {
  const list = [resto('1', 'Burger'), resto('2', 'Burger'), resto('3', 'Japonais')];
  const counts = countFamilies(list);

  it('affiche « Tout » et chaque famille avec son nombre', () => {
    const html = renderToStaticMarkup(createElement(FamilyChips, { counts, total: 3, value: null, onChange: noop }));
    expect(html).toContain('Tout (3)');
    expect(html).toContain('Burger &amp; street (2)');
    expect(html).toContain('Asie (1)');
  });

  it('marque la famille choisie comme active, et « Tout » seulement sans filtre', () => {
    const on = renderToStaticMarkup(createElement(FamilyChips, { counts, total: 3, value: 'asie', onChange: noop }));
    expect(on.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(on).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*Asie \(1\)/);
    const none = renderToStaticMarkup(createElement(FamilyChips, { counts, total: 3, value: null, onChange: noop }));
    expect(none).toMatch(/aria-pressed="true"[^>]*>Tout \(3\)/);
  });

  it('ne s’affiche pas quand il n’y a qu’un seul type à choisir', () => {
    expect(renderToStaticMarkup(createElement(FamilyChips, { counts: countFamilies([resto('1', 'Burger'), resto('2', 'Burger')]), total: 2, value: null, onChange: noop }))).toBe('');
    expect(renderToStaticMarkup(createElement(FamilyChips, { counts: [], total: 0, value: null, onChange: noop }))).toBe('');
  });
});
