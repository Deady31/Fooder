import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUISINE_OPTIONS,
  MAX_CUISINES,
  PROFILE_KEY,
  PROFILE_VERSION,
  Profile,
  buildProfile,
  completeOnboarding,
  deriveCraving,
  hasCompletedOnboarding,
  migrateProfile,
  readProfile,
  toLegacyPreferences,
  writeProfile,
} from '../lib/profile';
import { extractRef } from '../lib/refParam';
import { QUARTIERS } from '../lib/quartiers';
import { stickerSrc } from '../lib/stickers';

const draft = {
  pseudo: 'Riyan',
  gender: 'male',
  ageRange: '25_34',
  cuisines: ['japonais', 'ramen'],
  diets: ['halal'],
  budget: 2,
  vibes: ['friends', 'terrace'],
  frequency: 'weekly',
  aversions: ['cilantro'],
  quartier: 'Capitole',
  companions: 'friends',
};

function makeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('catalogue de cuisines', () => {
  it('a environ 24 choix aux ids uniques, avec un sticker valide', () => {
    expect(CUISINE_OPTIONS.length).toBe(24);
    expect(new Set(CUISINE_OPTIONS.map(c => c.id)).size).toBe(CUISINE_OPTIONS.length);
    for (const c of CUISINE_OPTIONS) {
      expect(stickerSrc(c.sticker), c.id).toBeTruthy();
      expect(c.label.length).toBeGreaterThan(1);
    }
  });
});

describe('buildProfile', () => {
  it('construit un profil complet et versionné', () => {
    const p = buildProfile(draft, 1000);
    expect(p).toMatchObject({ version: PROFILE_VERSION, pseudo: 'Riyan', budget: 2, completedAt: 1000 });
    expect(p?.cuisines).toEqual(['japonais', 'ramen']);
  });

  it('retourne null sans pseudo valide', () => {
    expect(buildProfile({ ...draft, pseudo: 'admin' })).toBeNull();
    expect(buildProfile({ ...draft, pseudo: '' })).toBeNull();
  });

  it('applique des valeurs par défaut aux champs manquants (profil minimal)', () => {
    const p = buildProfile({ pseudo: 'Riyan' }, 5);
    expect(p).toMatchObject({
      gender: 'unspecified', ageRange: null, cuisines: [], diets: [], budget: null,
      vibes: [], frequency: null, aversions: [], quartier: null, companions: null,
    });
  });
});

describe('migrateProfile (défensif)', () => {
  it('rejette tout ce qui n’est pas un objet', () => {
    for (const bad of [null, undefined, 42, 'x', [], true]) expect(migrateProfile(bad)).toBeNull();
  });

  it('rejette un profil sans pseudo valide', () => {
    expect(migrateProfile({ version: 1, pseudo: 'x' })).toBeNull();
    expect(migrateProfile({ version: 1, pseudo: 'fooder' })).toBeNull();
    expect(migrateProfile({ version: 1 })).toBeNull();
  });

  it('accepte un profil valide tel quel', () => {
    const p = buildProfile(draft, 1)!;
    expect(migrateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('élimine les valeurs inconnues et les doublons', () => {
    const p = migrateProfile({
      version: 1, pseudo: 'Riyan', gender: 'alien', ageRange: '12', budget: 9,
      cuisines: ['japonais', 'japonais', 'inconnu', 42], diets: ['vegan', 'vegan', 'carnivore'],
      vibes: ['calm', 'nope'], frequency: 'daily', aversions: ['spicy', 1], quartier: 'Atlantide',
      companions: 'chien',
    })!;
    expect(p.gender).toBe('unspecified');
    expect(p.ageRange).toBeNull();
    expect(p.budget).toBeNull();
    expect(p.cuisines).toEqual(['japonais']);
    expect(p.diets).toEqual(['vegan']);
    expect(p.vibes).toEqual(['calm']);
    expect(p.frequency).toBeNull();
    expect(p.aversions).toEqual(['spicy']);
    expect(p.quartier).toBeNull();
    expect(p.companions).toBeNull();
  });

  it('plafonne les cuisines à MAX_CUISINES', () => {
    const ids = CUISINE_OPTIONS.map(c => c.id);
    const p = migrateProfile({ version: 1, pseudo: 'Riyan', cuisines: ids })!;
    expect(p.cuisines).toHaveLength(MAX_CUISINES);
  });

  it('accepte un quartier connu', () => {
    expect(migrateProfile({ version: 1, pseudo: 'Riyan', quartier: QUARTIERS[0].name })!.quartier).toBe(QUARTIERS[0].name);
  });

  it('tolère une version absente ou future et renvoie la version courante', () => {
    expect(migrateProfile({ pseudo: 'Riyan' })!.version).toBe(PROFILE_VERSION);
    expect(migrateProfile({ version: 99, pseudo: 'Riyan' })!.version).toBe(PROFILE_VERSION);
  });

  it('ne fait pas confiance aux types (tableaux déguisés, chaînes)', () => {
    const p = migrateProfile({ version: 1, pseudo: 'Riyan', cuisines: 'japonais', diets: { 0: 'vegan' }, vibes: null })!;
    expect(p.cuisines).toEqual([]);
    expect(p.diets).toEqual([]);
    expect(p.vibes).toEqual([]);
  });

  it('ne mute pas l’entrée', () => {
    const input = { version: 1, pseudo: 'Riyan', cuisines: ['japonais', 'japonais'] };
    const copy = JSON.parse(JSON.stringify(input));
    migrateProfile(input);
    expect(input).toEqual(copy);
  });
});

describe('deriveCraving / préférences historiques', () => {
  it('prend l’humeur dominante des cuisines choisies', () => {
    expect(deriveCraving(['japonais', 'ramen', 'thai'])).toBe('asie');
    expect(deriveCraving(['burger', 'kebab'])).toBe('street');
  });
  it('retombe sur « surprise » si rien ou mélangé', () => {
    expect(deriveCraving([])).toBe('surprise');
    expect(deriveCraving(['japonais', 'burger'])).toBe('surprise');
    expect(deriveCraving(['italien'])).toBe('surprise');
  });

  it('produit les champs lus par la page swipe', () => {
    const p = buildProfile({ ...draft, budget: 3, cuisines: ['japonais', 'ramen'] }, 1)!;
    const prefs = toLegacyPreferences(p, { foo: 'bar', craving: 'veggie' });
    expect(prefs.budget).toBe(70);
    expect(prefs.craving).toBe('asie');
    expect(prefs.cravingLabel).toBe('Tour en Asie');
    expect(prefs.cuisineFilter).toBe('Asiatique');
    expect(prefs.cuisines).toEqual(['japonais', 'ramen']);
    expect(prefs.foo).toBe('bar');
  });

  it('budget par défaut 35 sans choix', () => {
    expect(toLegacyPreferences(buildProfile({ pseudo: 'Riyan' }, 1)!, {}).budget).toBe(35);
  });
});

describe('stockage', () => {
  let storage: ReturnType<typeof makeStorage>;
  let session: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
    session = makeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('readProfile renvoie null au départ et après JSON corrompu', () => {
    expect(readProfile()).toBeNull();
    storage.setItem(PROFILE_KEY, '{oups');
    expect(readProfile()).toBeNull();
  });

  it('writeProfile puis readProfile font l’aller-retour', () => {
    const p = buildProfile(draft, 7)!;
    expect(writeProfile(p)).toBe(true);
    expect(PROFILE_KEY).toBe('fooder_profile');
    expect(readProfile()).toEqual(p);
  });

  it('hasCompletedOnboarding : ancien drapeau ou profil', () => {
    expect(hasCompletedOnboarding()).toBe(false);
    storage.setItem('fooder_onboarding_done', '1');
    expect(hasCompletedOnboarding()).toBe(true);
    storage.data.clear();
    writeProfile(buildProfile(draft, 1)!);
    expect(hasCompletedOnboarding()).toBe(true);
  });

  it('completeOnboarding alimente tout : profil, identité, préférences, drapeau', () => {
    storage.setItem('fooder_preferences', JSON.stringify({ budget: 50, craving: 'veggie', other: 1 }));
    const p = buildProfile(draft, 1)!;
    expect(completeOnboarding(p)).toBe(true);

    expect(JSON.parse(storage.getItem('fooder_profile')!).pseudo).toBe('Riyan');
    expect(storage.getItem('fooder_onboarding_done')).toBe('1');
    expect(JSON.parse(storage.getItem('fooder_me')!).name).toBe('Riyan');
    const prefs = JSON.parse(storage.getItem('fooder_preferences')!);
    expect(prefs).toMatchObject({ budget: 35, craving: 'asie', other: 1, cuisines: ['japonais', 'ramen'] });
  });

  it('completeOnboarding conserve l’identité existante (id stable)', () => {
    storage.setItem('fooder_me', JSON.stringify({ id: 'u123', name: 'foodie12', createdAt: 5, code: 'ABC' }));
    completeOnboarding(buildProfile(draft, 1)!);
    expect(JSON.parse(storage.getItem('fooder_me')!)).toMatchObject({ id: 'u123', name: 'Riyan', code: 'ABC', createdAt: 5 });
  });
});

describe('extractRef', () => {
  it('lit le paramètre ref', () => {
    expect(extractRef('?ref=ABC123')).toBe('ABC123');
    expect(extractRef('?x=1&ref=Zoe-42')).toBe('Zoe-42');
  });
  it('ignore l’absent, le vide et les valeurs douteuses', () => {
    expect(extractRef('')).toBeNull();
    expect(extractRef('?ref=')).toBeNull();
    expect(extractRef('?foo=bar')).toBeNull();
    expect(extractRef('?ref=<script>')).toBeNull();
    expect(extractRef('?ref=' + 'a'.repeat(65))).toBeNull();
    expect(extractRef(null as unknown as string)).toBeNull();
  });
});

describe('type Profile', () => {
  it('est assignable', () => {
    const p: Profile | null = buildProfile(draft, 1);
    expect(p).not.toBeNull();
  });
});
