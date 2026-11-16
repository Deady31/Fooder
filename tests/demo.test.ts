import { describe, expect, it } from 'vitest';
import { DEMO_PSEUDO, decideDemoStart } from '../lib/demo';
import { buildProfile } from '../lib/profile';
import { shouldShowTermsGate } from '../lib/legal';

describe('mode démo', () => {
  it('crée un invité seulement pour un visiteur sans profil', () => {
    expect(decideDemoStart({ registered: false, demo: false })).toBe('create_guest');
    expect(decideDemoStart({ registered: true, demo: false })).toBe('keep_profile');
    expect(decideDemoStart({ registered: true, demo: true })).toBe('already_demo');
  });
  it('le pseudo invité donne un profil valide, sans e-mail', () => {
    const p = buildProfile({ pseudo: DEMO_PSEUDO });
    expect(p?.pseudo).toBe(DEMO_PSEUDO);
    expect(p?.contactEmail).toBeNull();
  });
  it('la fenêtre des conditions ne s’ouvre pas en démo', () => {
    expect(shouldShowTermsGate({ pathname: '/swipe', onboardingDone: true, acceptance: null, demo: true })).toBe(false);
    expect(shouldShowTermsGate({ pathname: '/swipe', onboardingDone: true, acceptance: null })).toBe(true);
  });
});
