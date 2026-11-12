import { describe, expect, it } from 'vitest';
import { migrateMissionIds } from '../lib/missions';

const TEMPLATES = [
  { id: 'like_gastro', title: 'Gastronome', description: 'Like un resto > 50€', emoji: '🍷', target: 1, xpReward: 35 },
  { id: 'swipe_5', title: '5 restos explorés', description: 'Swipe 5 restaurants', emoji: '👆', target: 5, xpReward: 25 },
];

const stored = (id: string, current = 0, completed = false) => ({
  id, title: 'Ancien', description: 'Ancien', emoji: 'x', target: 1, xpReward: 1, current, completed,
});

describe('migrateMissionIds', () => {
  it('convertit like_premium en like_gastro en gardant la progression', () => {
    const [m] = migrateMissionIds([stored('like_premium', 1, true)], TEMPLATES);
    expect(m.id).toBe('like_gastro');
    expect(m.title).toBe('Gastronome');
    expect(m.xpReward).toBe(35);
    expect(m.current).toBe(1);
    expect(m.completed).toBe(true);
  });

  it('laisse les autres missions inchangées', () => {
    const list = [stored('swipe_5', 2)];
    expect(migrateMissionIds(list, TEMPLATES)).toEqual(list);
  });

  it('ne crée pas de doublon si like_gastro est déjà présent', () => {
    const out = migrateMissionIds([stored('like_gastro'), stored('like_premium')], TEMPLATES);
    expect(out.map(m => m.id)).toEqual(['like_gastro']);
  });

  it('tolère une valeur invalide', () => {
    expect(migrateMissionIds(undefined, TEMPLATES)).toEqual([]);
    expect(migrateMissionIds('x' as never, TEMPLATES)).toEqual([]);
  });
});
