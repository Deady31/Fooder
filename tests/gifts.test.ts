import { describe, expect, it } from 'vitest';
import { GIFTS, giftStatus, hasExampleGifts, nextGift } from '../lib/gifts';

describe('Mes cadeaux', () => {
  it('débloque un bon au niveau requis', () => {
    expect(giftStatus({ level: 3 }, 2)).toBe('locked');
    expect(giftStatus({ level: 3 }, 3)).toBe('unlocked');
    expect(giftStatus({ level: 3 }, NaN)).toBe('locked');
  });
  it('donne le prochain bon, puis plus rien au niveau max', () => {
    expect(nextGift(1)?.level).toBe(3);
    expect(nextGift(4)?.level).toBe(5);
    expect(nextGift(10)).toBeUndefined();
  });
  it('reste étiqueté « exemple » tant que le catalogue n’a pas de vrai partenaire', () => {
    expect(GIFTS.every(g => g.example)).toBe(true);
    expect(hasExampleGifts()).toBe(true);
    expect(hasExampleGifts([])).toBe(false);
  });
});
