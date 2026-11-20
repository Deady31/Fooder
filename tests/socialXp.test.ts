import { describe, expect, it } from 'vitest';
import { DEFI_DAILY_CAP, EMPTY_SOCIAL_XP, claimDefiXp, normalizeSocialXp } from '../lib/socialXp';

const T = Date.parse('2026-11-15T10:00:00Z');
const DAY = 24 * 3600_000;

describe('socialXp : plafond quotidien et anti-doublon des défis', () => {
  it('paie un défi envoyé, une seule fois par défi', () => {
    const a = claimDefiXp(EMPTY_SOCIAL_XP, 'sent', 'dA', T);
    expect(a.paid).toBe(true);
    const again = claimDefiXp(a.state, 'sent', 'dA', T);
    expect(again.paid).toBe(false);
    expect(again.reason).toBe('already');
  });

  it('plafonne les défis envoyés par jour', () => {
    let state = EMPTY_SOCIAL_XP;
    for (let i = 0; i < DEFI_DAILY_CAP.sent; i++) {
      const r = claimDefiXp(state, 'sent', `d${i}`, T);
      expect(r.paid).toBe(true);
      state = r.state;
    }
    const over = claimDefiXp(state, 'sent', 'dX', T);
    expect(over.paid).toBe(false);
    expect(over.reason).toBe('cap');
  });

  it('le plafond repart le lendemain', () => {
    let state = EMPTY_SOCIAL_XP;
    for (let i = 0; i < DEFI_DAILY_CAP.sent; i++) state = claimDefiXp(state, 'sent', `d${i}`, T).state;
    expect(claimDefiXp(state, 'sent', 'dNew', T + DAY).paid).toBe(true);
  });

  it('envoyé et relevé ont chacun leur plafond', () => {
    let state = EMPTY_SOCIAL_XP;
    for (let i = 0; i < DEFI_DAILY_CAP.sent; i++) state = claimDefiXp(state, 'sent', `d${i}`, T).state;
    expect(claimDefiXp(state, 'done', 'dA', T).paid).toBe(true);
  });

  it('un défi refusé (plafond) n’est pas retenu : il pourra payer un autre jour', () => {
    let state = EMPTY_SOCIAL_XP;
    for (let i = 0; i < DEFI_DAILY_CAP.done; i++) state = claimDefiXp(state, 'done', `d${i}`, T).state;
    const refused = claimDefiXp(state, 'done', 'dLate', T);
    expect(refused.paid).toBe(false);
    expect(claimDefiXp(refused.state, 'done', 'dLate', T + DAY).paid).toBe(true);
  });

  it('ne modifie jamais l’état d’origine', () => {
    claimDefiXp(EMPTY_SOCIAL_XP, 'sent', 'dA', T);
    expect(EMPTY_SOCIAL_XP.claimed).toHaveLength(0);
  });

  it('tolère un état corrompu', () => {
    expect(normalizeSocialXp(null)).toEqual(EMPTY_SOCIAL_XP);
    expect(normalizeSocialXp({ day: 5, counts: 'x', claimed: [1, 'ok'] }).claimed).toEqual(['ok']);
  });

  it('borne la mémoire des défis déjà payés', () => {
    let state = EMPTY_SOCIAL_XP;
    for (let i = 0; i < 400; i++) state = claimDefiXp(state, 'sent', `d${i}`, T + i * DAY).state;
    expect(state.claimed.length).toBeLessThanOrEqual(200);
  });
});
