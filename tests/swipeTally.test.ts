import { describe, expect, it } from 'vitest';
import type { Restaurant } from '../data/mockRestaurants';
import { EMPTY_TALLY, addSwipe, tallyTotal, undoSwipe } from '../components/swipe/swipeTally';

const resto = (id: string): Restaurant => ({ id, name: id, cuisine: 'x', rating: 0, price: 10, distance: '', image: '', address: '', description: '' });

describe('swipeTally', () => {
  it('compte les MIAM (liste) et les BOF (nombre)', () => {
    let t = addSwipe(EMPTY_TALLY, 'right', resto('a'));
    t = addSwipe(t, 'left', resto('b'));
    t = addSwipe(t, 'right', resto('c'));
    expect(t.liked.map(r => r.id)).toEqual(['a', 'c']);
    expect(t.passed).toBe(1);
    expect(tallyTotal(t)).toBe(3);
  });

  it('un même resto ne compte qu’un MIAM', () => {
    const t = addSwipe(addSwipe(EMPTY_TALLY, 'right', resto('a')), 'right', resto('a'));
    expect(t.liked).toHaveLength(1);
  });

  it('annule un MIAM ou un BOF, sans passer sous zéro', () => {
    const t = addSwipe(addSwipe(EMPTY_TALLY, 'right', resto('a')), 'left', resto('b'));
    expect(undoSwipe(t, 'right', 'a').liked).toHaveLength(0);
    expect(undoSwipe(t, 'left', 'b').passed).toBe(0);
    expect(undoSwipe(EMPTY_TALLY, 'left', 'z').passed).toBe(0);
    expect(undoSwipe(EMPTY_TALLY, 'right', 'z')).toBe(EMPTY_TALLY);
  });

  it('ne modifie jamais le bilan d’origine', () => {
    const t = addSwipe(EMPTY_TALLY, 'right', resto('a'));
    addSwipe(t, 'left', resto('b'));
    expect(t.passed).toBe(0);
    expect(EMPTY_TALLY.liked).toHaveLength(0);
  });
});
