import { describe, expect, it } from 'vitest';
import { daysLeftInWeek, streakHint } from '../components/profile/streakHint';

const at = (iso: string) => new Date(iso).getTime();

describe('daysLeftInWeek', () => {
  it('lundi = 7, dimanche = 1 (aujourd’hui compris)', () => {
    expect(daysLeftInWeek(at('2026-11-09T10:00:00'))).toBe(7);
    expect(daysLeftInWeek(at('2026-11-11T10:00:00'))).toBe(5);
    expect(daysLeftInWeek(at('2026-11-15T22:00:00'))).toBe(1);
  });
});

describe('streakHint', () => {
  const now = at('2026-11-13T10:00:00'); // vendredi : 3 jours
  it('aucun message sans série ou semaine déjà validée', () => {
    expect(streakHint({ current: 0, thisWeekDone: false }, now)).toBeNull();
    expect(streakHint({ current: 3, thisWeekDone: true }, now)).toBeNull();
  });
  it('décompte au pluriel, urgent à 2 jours ou moins', () => {
    const h = streakHint({ current: 3, thisWeekDone: false }, now)!;
    expect(h.text).toBe('Plus que 3 jours pour garder ta série');
    expect(h.urgent).toBe(false);
    const last = streakHint({ current: 3, thisWeekDone: false }, at('2026-11-15T09:00:00'))!;
    expect(last.text).toBe('Plus que 1 jour pour garder ta série');
    expect(last.urgent).toBe(true);
  });
});
