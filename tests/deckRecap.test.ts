import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { DeckEnd } from '../components/swipe/DeckStates';
import { EMPTY_TALLY, addSwipe } from '../components/swipe/swipeTally';

// Le transformateur de test compile le JSX en React.createElement : React doit être global.
(globalThis as { React?: unknown }).React = React;

const resto = (id: string, cuisine = 'Burger'): Restaurant => ({ id, name: `Resto ${id}`, cuisine, rating: 0, price: 10, distance: '', image: '', address: '', description: '' });
const base = { widenTo: undefined, onWiden: () => undefined, canUndo: false, onUndo: () => undefined, radius: 2000 as never, onMood: () => undefined };

describe('récap de fin de paquet', () => {
  it('affiche MIAM, BOF et les restos retenus (5 max : 4 + « autres »)', () => {
    let t = EMPTY_TALLY;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) t = addSwipe(t, 'right', resto(id));
    t = addSwipe(t, 'left', resto('z'));
    const html = renderToStaticMarkup(createElement(DeckEnd, { ...base, tally: t }));
    expect(html).toContain('6 MIAM');
    expect(html).toContain('1 BOF');
    expect(html).toContain('Resto f'); // le plus récent d'abord
    expect(html).not.toContain('Resto a'); // hors des 4 derniers
    expect(html).toContain('+ 2 autres');
  });

  it('les sorties passent avant le récap (les boutons ne tombent pas sous la ligne de flottaison)', () => {
    const t = addSwipe(EMPTY_TALLY, 'right', resto('a'));
    const html = renderToStaticMarkup(createElement(DeckEnd, { ...base, tally: t, widenTo: 5000 as never }));
    expect(html.indexOf('Élargir à')).toBeLessThan(html.indexOf('Récap de ton paquet'));
    expect(html.indexOf('Voir mes coups de cœur')).toBeLessThan(html.indexOf('Récap de ton paquet'));
  });

  it('sans swipe dans la session, pas de récap', () => {
    const html = renderToStaticMarkup(createElement(DeckEnd, { ...base, tally: EMPTY_TALLY }));
    expect(html).not.toContain('Récap de ton paquet');
    expect(html).toContain('Tu as tout swipé');
  });

  it('chaque resto retenu ouvre sa fiche (bouton nommé) quand onOpen est fourni', () => {
    const t = addSwipe(EMPTY_TALLY, 'right', resto('a'));
    const opened: string[] = [];
    const html = renderToStaticMarkup(createElement(DeckEnd, { ...base, tally: t, onOpen: (r: Restaurant) => opened.push(r.id) }));
    expect(html).toContain('Ouvrir la fiche de Resto a');
    expect(html).toContain('Touche un resto pour ouvrir sa fiche');
    expect(opened).toEqual([]);
  });

  it('sans onOpen, aucun resto n’est cliquable (fin de paquet en lecture seule)', () => {
    const t = addSwipe(EMPTY_TALLY, 'right', resto('a'));
    const html = renderToStaticMarkup(createElement(DeckEnd, { ...base, tally: t }));
    expect(html).toContain('Resto a');
    expect(html).not.toContain('Ouvrir la fiche de');
    expect(html).not.toContain('Touche un resto pour ouvrir sa fiche');
  });
});
