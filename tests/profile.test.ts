import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NEUTRAL_BUDGET_EUROS,
  ONBOARDING_DRAFT_KEY,
  PROFILE_KEY,
  PROFILE_VERSION,
  Profile,
  buildProfile,
  completeOnboarding,
  hasCompletedOnboarding,
  migrateProfile,
  neutralPreferences,
  readProfile,
  writeProfile,
} from '../lib/profile';
import { extractRef } from '../lib/refParam';
import { QUARTIERS } from '../lib/quartiers';

/** Réponses du nouvel onboarding : pseudo, genre, âge, régime (+ e-mail facultatif). */
const draft = {
  pseudo: 'Riyan',
  gender: 'male',
  ageRange: '25_34',
  diets: ['halal'],
};

/** Profil tel que l'ancien onboarding (13 étapes) l'a enregistré. */
const legacyProfile = {
  version: 1,
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
  completedAt: 123,
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

describe('buildProfile', () => {
  it('construit un profil minimal et versionné (pseudo, genre, âge, régimes)', () => {
    const p = buildProfile(draft, 1000);
    expect(p).toMatchObject({
      version: PROFILE_VERSION, pseudo: 'Riyan', gender: 'male', ageRange: '25_34', diets: ['halal'], completedAt: 1000,
    });
  });

  it('ne produit plus les anciens champs pour un nouveau parcours', () => {
    const fresh = buildProfile(draft, 1)!;
    for (const k of ['cuisines', 'budget', 'vibes', 'frequency', 'aversions', 'quartier', 'companions']) {
      expect(fresh, k).not.toHaveProperty(k);
    }
  });

  it('retourne null sans pseudo valide', () => {
    expect(buildProfile({ ...draft, pseudo: 'admin' })).toBeNull();
    expect(buildProfile({ ...draft, pseudo: '' })).toBeNull();
  });

  it('applique des valeurs par défaut aux champs manquants', () => {
    expect(buildProfile({ pseudo: 'Riyan' }, 5)).toEqual({
      version: PROFILE_VERSION, pseudo: 'Riyan', gender: 'unspecified', ageRange: null, diets: [],
      contactEmail: null, completedAt: 5,
    });
  });

  it('garde l’e-mail de contact normalisé, ignore un e-mail invalide', () => {
    expect(buildProfile({ ...draft, contactEmail: '  Riyan@Example.COM ' }, 1)?.contactEmail).toBe('riyan@example.com');
    expect(buildProfile({ ...draft, contactEmail: 'pas-un-mail' }, 1)?.contactEmail).toBeNull();
    expect(buildProfile({ ...draft, contactEmail: '' }, 1)?.contactEmail).toBeNull();
    expect(buildProfile({ ...draft, contactEmail: 42 }, 1)?.contactEmail).toBeNull();
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

  it('accepte un profil valide tel quel (aller-retour JSON)', () => {
    const p = buildProfile(draft, 1)!;
    expect(migrateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('lit un ancien profil (13 étapes) sans erreur et conserve ses anciens champs', () => {
    const p = migrateProfile(legacyProfile)!;
    expect(p).toMatchObject({
      pseudo: 'Riyan', gender: 'male', ageRange: '25_34', diets: ['halal'], completedAt: 123,
      cuisines: ['japonais', 'ramen'], budget: 2, vibes: ['friends', 'terrace'], frequency: 'weekly',
      aversions: ['cilantro'], quartier: 'Capitole', companions: 'friends', contactEmail: null,
    });
    // Ré-écrire puis relire un ancien profil est stable.
    expect(migrateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('lit un ancien profil réduit au strict minimum', () => {
    expect(migrateProfile({ pseudo: 'Riyan' })).toMatchObject({ pseudo: 'Riyan', gender: 'unspecified', diets: [] });
  });

  it('élimine les valeurs inconnues et les doublons', () => {
    const p = migrateProfile({
      version: 1, pseudo: 'Riyan', gender: 'alien', ageRange: '12', budget: 9,
      cuisines: ['japonais', 'japonais', 42, ''], diets: ['vegan', 'vegan', 'carnivore'],
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

  it('plafonne les anciennes cuisines à 6', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    expect(migrateProfile({ version: 1, pseudo: 'Riyan', cuisines: ids })!.cuisines).toHaveLength(6);
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

describe('préférences du deck par défaut (neutres)', () => {
  it('humeur « Surprends-moi », aucun filtre de cuisine, budget non limitant', () => {
    const prefs = neutralPreferences({});
    expect(prefs).toMatchObject({
      craving: 'surprise', cravingLabel: 'Surprends-moi', cuisineFilter: 'All', cuisines: [], budget: NEUTRAL_BUDGET_EUROS,
    });
  });

  it('le budget neutre couvre la plus haute valeur du curseur de filtre (150 €)', () => {
    expect(NEUTRAL_BUDGET_EUROS).toBeGreaterThanOrEqual(150);
  });

  it('écrase une humeur ou un budget restrictifs mais garde les autres champs', () => {
    const prefs = neutralPreferences({ craving: 'asie', cravingLabel: 'Tour en Asie', budget: 20, foo: 'bar' });
    expect(prefs.craving).toBe('surprise');
    expect(prefs.budget).toBe(NEUTRAL_BUDGET_EUROS);
    expect(prefs.foo).toBe('bar');
  });

  it('ne mute pas l’entrée', () => {
    const input = { craving: 'asie' };
    neutralPreferences(input);
    expect(input).toEqual({ craving: 'asie' });
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

  it('readProfile relit un ancien profil enregistré', () => {
    storage.setItem(PROFILE_KEY, JSON.stringify(legacyProfile));
    expect(readProfile()).toMatchObject({ pseudo: 'Riyan', cuisines: ['japonais', 'ramen'], budget: 2 });
  });

  it('hasCompletedOnboarding : ancien drapeau ou profil', () => {
    expect(hasCompletedOnboarding()).toBe(false);
    storage.setItem('fooder_onboarding_done', '1');
    expect(hasCompletedOnboarding()).toBe(true);
    storage.data.clear();
    writeProfile(buildProfile(draft, 1)!);
    expect(hasCompletedOnboarding()).toBe(true);
  });

  it('completeOnboarding alimente tout : profil, identité, préférences neutres, drapeau', () => {
    storage.setItem('fooder_preferences', JSON.stringify({ budget: 50, craving: 'asie', other: 1 }));
    const p = buildProfile({ ...draft, contactEmail: 'riyan@example.com' }, 1)!;
    expect(completeOnboarding(p)).toBe(true);

    const stored = JSON.parse(storage.getItem('fooder_profile')!);
    expect(stored.pseudo).toBe('Riyan');
    expect(stored.contactEmail).toBe('riyan@example.com');
    expect(storage.getItem('fooder_onboarding_done')).toBe('1');
    expect(JSON.parse(storage.getItem('fooder_me')!).name).toBe('Riyan');
    const prefs = JSON.parse(storage.getItem('fooder_preferences')!);
    expect(prefs).toMatchObject({
      budget: NEUTRAL_BUDGET_EUROS, craving: 'surprise', cravingLabel: 'Surprends-moi', cuisineFilter: 'All', cuisines: [], other: 1,
    });
  });

  it('completeOnboarding efface le brouillon', () => {
    storage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ step: 'final' }));
    completeOnboarding(buildProfile(draft, 1)!);
    expect(storage.getItem(ONBOARDING_DRAFT_KEY)).toBeNull();
  });

  it('completeOnboarding n’appelle aucun service distant (stockage local uniquement)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    completeOnboarding(buildProfile({ ...draft, contactEmail: 'riyan@example.com' }, 1)!);
    expect(fetchSpy).not.toHaveBeenCalled();
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
