import { describe, expect, it } from 'vitest';
import { shouldPublishOnline } from '../lib/checkinPublish';

const base = { publishOnline: false, rightsConfirmed: false, hasPhoto: false, hasCaption: false };

describe('shouldPublishOnline (check-in)', () => {
  it('jamais par défaut : photo et mot restent en local', () => {
    expect(shouldPublishOnline({ ...base, hasPhoto: true, hasCaption: true })).toBe(false);
    expect(shouldPublishOnline({ ...base, hasPhoto: true, rightsConfirmed: true })).toBe(false);
  });
  it('photo : exige le choix explicite ET les droits confirmés', () => {
    expect(shouldPublishOnline({ ...base, publishOnline: true, hasPhoto: true })).toBe(false);
    expect(shouldPublishOnline({ ...base, publishOnline: true, hasPhoto: true, rightsConfirmed: true })).toBe(true);
  });
  it('mot seul : le choix explicite suffit', () => {
    expect(shouldPublishOnline({ ...base, publishOnline: true, hasCaption: true })).toBe(true);
  });
  it('rien à publier : false même si coché', () => {
    expect(shouldPublishOnline({ ...base, publishOnline: true, rightsConfirmed: true })).toBe(false);
  });
});
