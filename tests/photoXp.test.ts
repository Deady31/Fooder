import { describe, expect, it } from 'vitest';
import {
  EMPTY_PHOTO_XP, PHOTOGRAPHER_TARGET, PHOTO_DAILY_CAP, PHOTO_XP_FIRST, PHOTO_XP_REPEAT,
  PhotoRewardInput, PhotoXpState, computePhotoReward, normalizePhotoXp, parisDay, photoRewardMessage,
} from '../lib/photoXp';

const NOON = Date.parse('2026-11-14T12:00:00Z');
const input = (over: Partial<PhotoRewardInput> = {}): PhotoRewardInput => ({ restId: 'r1', hasPhoto: true, knownPhotos: 0, now: NOON, ...over });

describe('parisDay', () => {
  it('utilise le jour de Paris, pas celui d’UTC', () => {
    expect(parisDay(Date.parse('2026-11-14T23:30:00Z'))).toBe('2026-11-15'); // 00h30 à Paris (hiver)
    expect(parisDay(Date.parse('2026-07-14T21:30:00Z'))).toBe('2026-07-14'); // 23h30 à Paris (été)
    expect(parisDay(Date.parse('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });
});

describe('computePhotoReward', () => {
  it('+30 XP pour la première photo connue du resto', () => {
    const r = computePhotoReward(EMPTY_PHOTO_XP, input());
    expect(r.reason).toBe('first');
    expect(r.xp).toBe(PHOTO_XP_FIRST);
    expect(PHOTO_XP_FIRST).toBe(30);
  });

  it('+10 XP s’il existe déjà au moins une photo communautaire', () => {
    const r = computePhotoReward(EMPTY_PHOTO_XP, input({ knownPhotos: 1 }));
    expect(r.reason).toBe('repeat');
    expect(r.xp).toBe(PHOTO_XP_REPEAT);
    expect(computePhotoReward(EMPTY_PHOTO_XP, input({ knownPhotos: 40 })).xp).toBe(10);
  });

  it('0 XP sans photo, et rien n’est mémorisé', () => {
    const r = computePhotoReward(EMPTY_PHOTO_XP, input({ hasPhoto: false }));
    expect(r).toMatchObject({ xp: 0, reason: 'no_photo' });
    expect(r.state).toEqual(EMPTY_PHOTO_XP);
  });

  it('une seule récompense par resto', () => {
    const first = computePhotoReward(EMPTY_PHOTO_XP, input());
    const again = computePhotoReward(first.state, input({ knownPhotos: 1 }));
    expect(again).toMatchObject({ xp: 0, reason: 'already_rewarded' });
    const other = computePhotoReward(first.state, input({ restId: 'r2' }));
    expect(other.xp).toBe(30);
  });

  it('plafond de 3 récompenses par jour de Paris, remis à zéro le lendemain', () => {
    let state: PhotoXpState = EMPTY_PHOTO_XP;
    for (let i = 0; i < PHOTO_DAILY_CAP; i++) {
      const r = computePhotoReward(state, input({ restId: `r${i}`, knownPhotos: 1 }));
      expect(r.xp).toBe(10);
      state = r.state;
    }
    const capped = computePhotoReward(state, input({ restId: 'r9' }));
    expect(capped).toMatchObject({ xp: 0, reason: 'daily_cap' });
    expect(capped.state.rewarded).not.toContain('r9'); // pas mémorisé : récompensable un autre jour

    const tomorrow = computePhotoReward(capped.state, input({ restId: 'r9', now: NOON + 24 * 3_600_000 }));
    expect(tomorrow.xp).toBe(30);
    expect(tomorrow.state.today).toBe(1);
  });

  it('le plafond bascule à minuit à Paris', () => {
    let state: PhotoXpState = EMPTY_PHOTO_XP;
    const late = Date.parse('2026-11-14T22:30:00Z'); // 23h30 Paris
    for (let i = 0; i < 3; i++) state = computePhotoReward(state, input({ restId: `a${i}`, now: late })).state;
    expect(computePhotoReward(state, input({ restId: 'b', now: late })).reason).toBe('daily_cap');
    expect(computePhotoReward(state, input({ restId: 'b', now: late + 3_600_000 })).xp).toBe(30); // 00h30 Paris
  });

  it('compte chaque photo publiée, même sans XP (succès Photographe)', () => {
    let state: PhotoXpState = EMPTY_PHOTO_XP;
    for (let i = 0; i < PHOTOGRAPHER_TARGET; i++) state = computePhotoReward(state, input({ restId: 'same' })).state;
    expect(state.posted).toBe(PHOTOGRAPHER_TARGET);
    expect(state.rewarded).toEqual(['same']);
  });

  it('ne mute pas l’état fourni', () => {
    const before = JSON.stringify(EMPTY_PHOTO_XP);
    computePhotoReward(EMPTY_PHOTO_XP, input());
    expect(JSON.stringify(EMPTY_PHOTO_XP)).toBe(before);
  });
});

describe('normalizePhotoXp', () => {
  it('tolère null, types invalides et valeurs absurdes', () => {
    expect(normalizePhotoXp(null)).toEqual(EMPTY_PHOTO_XP);
    expect(normalizePhotoXp('x')).toEqual(EMPTY_PHOTO_XP);
    expect(normalizePhotoXp({ rewarded: 'a', day: 3, today: -4, posted: 'z' })).toEqual(EMPTY_PHOTO_XP);
    expect(normalizePhotoXp({ rewarded: ['a', 2, 'b'], day: '2026-11-14', today: 2, posted: 7 }))
      .toEqual({ rewarded: ['a', 'b'], day: '2026-11-14', today: 2, posted: 7 });
  });
});

describe('photoRewardMessage', () => {
  it('message clair, vide si pas d’XP', () => {
    expect(photoRewardMessage(30)).toBe('+30 XP : ta photo aide les autres !');
    expect(photoRewardMessage(10)).toBe('+10 XP : ta photo aide les autres !');
    expect(photoRewardMessage(0)).toBeNull();
  });
});
