import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TERMS_FALLBACK_KEY,
  TERMS_VERSION,
  canFinishOnboarding,
  createAcceptance,
  isLegalPath,
  needsTermsAcceptance,
  sanitizeTermsAcceptance,
  shouldShowTermsGate,
} from '../lib/legal';
import { PROFILE_KEY, buildProfile, hasCompletedOnboarding, migrateProfile, readProfile, readTermsAcceptance, recordTermsAcceptance, writeProfile } from '../lib/profile';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

const NOW = Date.parse('2026-11-14T10:00:00Z');
const accepted = { termsAcceptedAt: '2026-11-13T09:00:00.000Z', termsVersion: TERMS_VERSION };

describe('acceptation requise à l’inscription', () => {
  it('la case doit être cochée', () => {
    expect(canFinishOnboarding(false)).toBe(false);
    expect(canFinishOnboarding(true)).toBe(true);
    expect(canFinishOnboarding(undefined as unknown as boolean)).toBe(false);
  });

  it('TERMS_VERSION est une date AAAA-MM-JJ', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('createAcceptance : date ISO et version courante', () => {
    expect(createAcceptance(NOW)).toEqual({ termsAcceptedAt: '2026-11-14T10:00:00.000Z', termsVersion: TERMS_VERSION });
  });

  it('le profil construit à la fin garde date et version', () => {
    const p = buildProfile({ pseudo: 'Riyan', ...createAcceptance(NOW) }, 1)!;
    expect(p.termsAcceptedAt).toBe('2026-11-14T10:00:00.000Z');
    expect(p.termsVersion).toBe(TERMS_VERSION);
    expect(migrateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('sans acceptation, le profil n’a aucun champ « terms » ; valeurs douteuses ignorées', () => {
    expect(buildProfile({ pseudo: 'Riyan' }, 1)).not.toHaveProperty('termsVersion');
    for (const bad of [{ termsAcceptedAt: 'hier', termsVersion: TERMS_VERSION }, { termsAcceptedAt: accepted.termsAcceptedAt, termsVersion: 'v2' }, { termsAcceptedAt: 5, termsVersion: 7 }]) {
      const p = buildProfile({ pseudo: 'Riyan', ...bad }, 1)!;
      expect(p).not.toHaveProperty('termsAcceptedAt');
      expect(p).not.toHaveProperty('termsVersion');
    }
  });
});

describe('needsTermsAcceptance (mise à jour de version)', () => {
  it('aucune acceptation ou données invalides : à accepter', () => {
    for (const a of [null, undefined, {}, 42, 'x', [], { termsVersion: TERMS_VERSION }, { termsAcceptedAt: accepted.termsAcceptedAt }]) {
      expect(needsTermsAcceptance(a), JSON.stringify(a)).toBe(true);
    }
  });
  it('version courante : rien à faire', () => {
    expect(needsTermsAcceptance(accepted)).toBe(false);
  });
  it('version plus ancienne : à ré-accepter ; plus récente : ok', () => {
    expect(needsTermsAcceptance({ ...accepted, termsVersion: '2026-01-01' })).toBe(true);
    expect(needsTermsAcceptance(accepted, '2027-01-01')).toBe(true);
    expect(needsTermsAcceptance({ ...accepted, termsVersion: '2027-02-01' })).toBe(false);
  });
  it('sanitizeTermsAcceptance exige les deux champs valides', () => {
    expect(sanitizeTermsAcceptance(accepted)).toEqual(accepted);
    expect(sanitizeTermsAcceptance({ termsAcceptedAt: 'nope', termsVersion: TERMS_VERSION })).toBeNull();
  });
});

describe('portée du TermsGate', () => {
  const base = { pathname: '/swipe', onboardingDone: true, acceptance: null as unknown };
  it('inscrit sans acceptation : affiché dans l’appli', () => {
    expect(shouldShowTermsGate(base)).toBe(true);
    expect(shouldShowTermsGate({ ...base, pathname: '/profile' })).toBe(true);
  });
  it('jamais sur les pages légales', () => {
    for (const p of ['/legal', '/legal/terms', '/legal/privacy', '/legal/community']) {
      expect(isLegalPath(p), p).toBe(true);
      expect(shouldShowTermsGate({ ...base, pathname: p }), p).toBe(false);
    }
    expect(isLegalPath('/legalement')).toBe(false);
    expect(isLegalPath(null)).toBe(false);
  });
  it('pas pour qui n’a pas fini l’inscription (la case y est obligatoire)', () => {
    expect(shouldShowTermsGate({ ...base, onboardingDone: false })).toBe(false);
  });
  it('plus affiché une fois la version à jour acceptée, de nouveau si la version monte', () => {
    expect(shouldShowTermsGate({ ...base, acceptance: accepted })).toBe(false);
    expect(shouldShowTermsGate({ ...base, acceptance: accepted, current: '2027-01-01' })).toBe(true);
  });
});

describe('enregistrement', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('profil existant : date et version ajoutées au profil, le reste intact', () => {
    const p = buildProfile({ pseudo: 'Riyan', gender: 'male', diets: ['halal'] }, 1)!;
    writeProfile(p);
    expect(readTermsAcceptance()).toBeNull();
    expect(recordTermsAcceptance(NOW)).toBe(true);
    expect(readProfile()).toEqual({ ...p, ...createAcceptance(NOW) });
    expect(readTermsAcceptance()).toEqual(createAcceptance(NOW));
    expect(storage.getItem(TERMS_FALLBACK_KEY)).toBeNull();
  });

  it('inscrit sans profil lisible : repli local', () => {
    storage.setItem('fooder_onboarding_done', '1');
    expect(hasCompletedOnboarding()).toBe(true);
    expect(recordTermsAcceptance(NOW)).toBe(true);
    expect(storage.getItem(PROFILE_KEY)).toBeNull();
    expect(readTermsAcceptance()).toEqual(createAcceptance(NOW));
  });

  it('stockage indisponible : false, sans exception', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('denied'); } });
    expect(recordTermsAcceptance(NOW)).toBe(false);
  });
});
