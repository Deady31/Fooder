import { describe, expect, it } from 'vitest';
import { shouldOpenOnRelease, MOVE_TOLERANCE } from '../components/swipe/tapIntent';
import { createRewardLedger } from '../components/swipe/rewardLedger';
import { removeById } from '../components/swipe/undo';
import { cardSummary, walkMinutes } from '../components/swipe/cardSummary';
import type { Restaurant } from '../data/mockRestaurants';

describe('tap pour ouvrir', () => {
  const ok = { distance: 2, pressActive: true, committedSwipe: false };

  it('constantes', () => {
    expect(MOVE_TOLERANCE).toBeGreaterThan(0);
  });

  it('un appui relâché sans glissement ouvre', () => {
    expect(shouldOpenOnRelease(ok)).toBe(true);
    expect(shouldOpenOnRelease({ ...ok, distance: 0 })).toBe(true);
  });

  it('un glissement au-delà de la tolérance n’ouvre pas', () => {
    expect(shouldOpenOnRelease({ ...ok, distance: MOVE_TOLERANCE })).toBe(false);
    expect(shouldOpenOnRelease({ ...ok, distance: 80 })).toBe(false);
  });

  it('un swipe validé n’ouvre jamais, même court', () => {
    expect(shouldOpenOnRelease({ ...ok, committedSwipe: true })).toBe(false);
  });

  it('pas d’ouverture si l’appui a été annulé', () => {
    expect(shouldOpenOnRelease({ ...ok, pressActive: false })).toBe(false);
  });

});

describe('rewardLedger (anti-farm d’XP)', () => {
  it('accorde une seule fois par clé', () => {
    const l = createRewardLedger();
    expect(l.claim('a:swipe')).toBe(true);
    expect(l.claim('a:swipe')).toBe(false);
    expect(l.claim('a:like')).toBe(true);
    expect(l.claim('b:swipe')).toBe(true);
  });

  it('les ledgers sont indépendants', () => {
    const l1 = createRewardLedger();
    const l2 = createRewardLedger();
    l1.claim('k');
    expect(l2.claim('k')).toBe(true);
  });
});

describe('undo helpers', () => {
  it('removeById retire sans muter', () => {
    const list = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const out = removeById(list, '2');
    expect(out).toEqual([{ id: '1' }, { id: '3' }]);
    expect(list).toHaveLength(3);
  });

  it('removeById : id absent = liste équivalente', () => {
    expect(removeById([{ id: '1' }], 'zz')).toEqual([{ id: '1' }]);
    expect(removeById([], 'zz')).toEqual([]);
  });
});

const rest = (extra: Partial<Restaurant> = {}): Restaurant => ({
  id: 'r', name: 'R', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Italien', image: '', address: 'Toulouse', description: '', ...extra,
});
const monday = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
const hours = Array.from({ length: 7 }, () => [[720, 1320]] as [number, number][]); // 12h-22h

describe('walkMinutes', () => {
  it('~80 m/min, arrondi, minimum 1', () => {
    expect(walkMinutes(240)).toBe(3);
    expect(walkMinutes(800)).toBe(10);
    expect(walkMinutes(20)).toBe(1);
  });
  it('inconnu ou invalide : null', () => {
    expect(walkMinutes(undefined)).toBeNull();
    expect(walkMinutes(NaN)).toBeNull();
    expect(walkMinutes(-5)).toBeNull();
  });
});

describe('cardSummary', () => {
  it('assemble les morceaux connus', () => {
    const s = cardSummary(rest({ hours, distanceMeters: 240, website: 'https://x.fr' }), monday(13));
    expect(s).toBe('Ouvert jusqu’à 22 h · 3 min à pied · carte en ligne');
  });

  it('n’invente rien : morceaux absents omis', () => {
    expect(cardSummary(rest(), monday(13))).toBe('');
    expect(cardSummary(rest({ distanceMeters: 160 }), monday(13))).toBe('2 min à pied');
    expect(cardSummary(rest({ website: 'https://x.fr' }), monday(13))).toBe('carte en ligne');
  });

  it('fermé', () => {
    expect(cardSummary(rest({ hours, distanceMeters: 80 }), monday(8))).toBe('Fermé · 1 min à pied');
  });

  it('ouvert sans heure de fermeture connue (24/7)', () => {
    const all = Array.from({ length: 7 }, () => [[0, 1440]] as [number, number][]);
    expect(cardSummary(rest({ hours: all }), monday(3))).toBe('Ouvert');
  });
});

import { removePendingCheckin } from '../components/swipe/undo';

describe('removePendingCheckin', () => {
  const c = (restId: string, status: 'pending' | 'done' | 'dismissed') => ({ restId, name: restId, cuisine: 'x', dueAt: 1, status });

  it('retire le rendez-vous en attente du resto', () => {
    expect(removePendingCheckin([c('a', 'pending'), c('b', 'pending')], 'a').map(x => x.restId)).toEqual(['b']);
  });

  it('garde un rendez-vous déjà traité', () => {
    expect(removePendingCheckin([c('a', 'done')], 'a')).toHaveLength(1);
  });

  it('ne touche pas une liste sans ce resto', () => {
    const list = [c('b', 'pending')];
    expect(removePendingCheckin(list, 'a')).toEqual(list);
  });
});
