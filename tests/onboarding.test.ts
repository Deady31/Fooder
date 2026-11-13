import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_MESSAGES, ONBOARDING_DRAFT_KEY, resetOnboardingForReplay, validateEmail } from '../lib/profile';
import {
  EMPTY_ANSWERS,
  ONBOARDING_STEPS,
  clearDraft,
  parseDraft,
  readDraft,
  stepAfter,
  stepBefore,
  visibleSteps,
  writeDraft,
} from '../lib/onboardingDraft';
import { extractRef, wantsReplay, withoutReplayParam } from '../lib/refParam';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('parcours', () => {
  it('accueil → pseudo → genre → âge → régime → aide → écran d’accueil → prêt', () => {
    expect([...ONBOARDING_STEPS]).toEqual(['welcome', 'pseudo', 'gender', 'age', 'diet', 'help', 'install', 'final']);
  });

  it('l’étape écran d’accueil disparaît du parcours si l’installation est impossible', () => {
    expect(visibleSteps(false)).not.toContain('install');
    expect(visibleSteps(false)).toHaveLength(7);
    expect(visibleSteps(true)).toEqual([...ONBOARDING_STEPS]);
  });

  it('stepAfter / stepBefore suivent le parcours visible', () => {
    expect(stepAfter('help', visibleSteps(true))).toBe('install');
    expect(stepAfter('help', visibleSteps(false))).toBe('final');
    expect(stepAfter('install', visibleSteps(false))).toBe('final');
    expect(stepAfter('final', visibleSteps(true))).toBe('final');
    expect(stepBefore('final', visibleSteps(true))).toBe('install');
    expect(stepBefore('final', visibleSteps(false))).toBe('help');
    expect(stepBefore('welcome', visibleSteps(true))).toBe('welcome');
  });

  it('les brouillons aux étapes « help » et « install » restent lisibles', () => {
    expect(parseDraft({ step: 'help' })?.step).toBe('help');
    expect(parseDraft({ step: 'install' })?.step).toBe('install');
  });
});

describe('validateEmail', () => {
  it('vide ou blanc : accepté, sans valeur (facultatif)', () => {
    expect(validateEmail('')).toEqual({ ok: true, value: null });
    expect(validateEmail('   ')).toEqual({ ok: true, value: null });
    expect(validateEmail(null)).toEqual({ ok: true, value: null });
    expect(validateEmail(undefined)).toEqual({ ok: true, value: null });
  });

  it('accepte les formats courants, trim et minuscules', () => {
    expect(validateEmail('a@b.fr')).toEqual({ ok: true, value: 'a@b.fr' });
    expect(validateEmail('  Jean.Dupont+fooder@Mail.Example.COM ')).toEqual({ ok: true, value: 'jean.dupont+fooder@mail.example.com' });
  });

  it('refuse les formats évidemment faux', () => {
    for (const bad of ['riyan', 'riyan@', '@mail.fr', 'riyan@mail', 'riyan@mail.', 'ri yan@mail.fr', 'a@@b.fr', 'a@b@c.fr', 'a@b.c', 'a@.fr']) {
      expect(validateEmail(bad), bad).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('refuse un type non texte et une adresse trop longue', () => {
    expect(validateEmail(42)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateEmail({})).toEqual({ ok: false, reason: 'invalid' });
    expect(validateEmail(`${'a'.repeat(250)}@b.fr`)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('a un message français pour chaque refus', () => {
    expect(EMAIL_MESSAGES.invalid).toMatch(/e-mail/i);
    expect(EMAIL_MESSAGES.too_long.length).toBeGreaterThan(5);
  });
});

describe('brouillon', () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  const answers = { pseudo: 'Riyan', gender: 'female' as const, ageRange: '18_24' as const, diets: ['vegan' as const], contactEmail: '' };

  it('clé dédiée', () => {
    expect(ONBOARDING_DRAFT_KEY).toBe('fooder_onboarding_draft');
  });

  it('readDraft : null sans brouillon', () => {
    expect(readDraft()).toBeNull();
  });

  it('survit au rechargement : étape et réponses relues à l’identique', () => {
    expect(writeDraft('age', answers)).toBe(true);
    expect(storage.getItem(ONBOARDING_DRAFT_KEY)).not.toBeNull();
    expect(readDraft()).toEqual({ step: 'age', answers });
  });

  it('le dernier état écrit l’emporte', () => {
    writeDraft('pseudo', EMPTY_ANSWERS);
    writeDraft('diet', answers);
    expect(readDraft()?.step).toBe('diet');
  });

  it('clearDraft efface le brouillon', () => {
    writeDraft('diet', answers);
    clearDraft();
    expect(readDraft()).toBeNull();
    expect(storage.getItem(ONBOARDING_DRAFT_KEY)).toBeNull();
  });

  it('JSON corrompu : null', () => {
    storage.setItem(ONBOARDING_DRAFT_KEY, '{oups');
    expect(readDraft()).toBeNull();
  });

  it('parseDraft : étape inconnue ou non-objet, null', () => {
    for (const bad of [null, 42, 'x', [], { step: 'budget', answers }, { step: 'cuisines' }, { answers }]) {
      expect(parseDraft(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('parseDraft : nettoie les réponses douteuses', () => {
    const d = parseDraft({
      step: 'gender',
      answers: { pseudo: 42, gender: 'alien', ageRange: '12', diets: ['vegan', 'vegan', 'carnivore'], contactEmail: { a: 1 } },
    })!;
    expect(d.step).toBe('gender');
    expect(d.answers).toEqual({ pseudo: '', gender: null, ageRange: null, diets: ['vegan'], contactEmail: '' });
  });

  it('parseDraft : réponses absentes = brouillon vide à l’étape donnée', () => {
    expect(parseDraft({ step: 'pseudo' })).toEqual({ step: 'pseudo', answers: EMPTY_ANSWERS });
  });

  it('parseDraft : borne la longueur des textes', () => {
    const d = parseDraft({ step: 'final', answers: { pseudo: 'p'.repeat(500), contactEmail: 'e'.repeat(500) } })!;
    expect(d.answers.pseudo.length).toBeLessThanOrEqual(32);
    expect(d.answers.contactEmail.length).toBeLessThanOrEqual(254);
  });

  it('ne mute pas EMPTY_ANSWERS', () => {
    const before = JSON.stringify(EMPTY_ANSWERS);
    parseDraft({ step: 'diet', answers: { diets: ['vegan'] } });
    expect(JSON.stringify(EMPTY_ANSWERS)).toBe(before);
  });
});

describe('rejouer (?rejouer=1)', () => {
  it('wantsReplay : seulement rejouer=1', () => {
    expect(wantsReplay('?rejouer=1')).toBe(true);
    expect(wantsReplay('?ref=ABC&rejouer=1')).toBe(true);
    for (const no of ['', '?rejouer=0', '?rejouer=', '?rejouer=oui', '?ref=ABC', null as unknown as string]) {
      expect(wantsReplay(no), String(no)).toBe(false);
    }
  });

  it('withoutReplayParam retire le paramètre et garde les autres (anti-boucle)', () => {
    expect(withoutReplayParam('?rejouer=1')).toBe('');
    expect(withoutReplayParam('?ref=ABC&rejouer=1')).toBe('?ref=ABC');
    expect(withoutReplayParam('?rejouer=1&ref=ABC')).toBe('?ref=ABC');
    expect(withoutReplayParam('?ref=ABC')).toBe('?ref=ABC');
    expect(withoutReplayParam('')).toBe('');
    expect(wantsReplay(withoutReplayParam('?rejouer=1'))).toBe(false);
  });

  it('le code de parrainage reste lisible après le retrait', () => {
    expect(extractRef(withoutReplayParam('?rejouer=1&ref=ZOE-42'))).toBe('ZOE-42');
  });

  describe('resetOnboardingForReplay', () => {
    let storage: ReturnType<typeof makeStorage>;
    beforeEach(() => {
      storage = makeStorage();
      vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('window', { dispatchEvent: () => true });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('supprime seulement drapeau, profil et brouillon', () => {
      const kept: Record<string, string> = {
        fooder_xp: '{"xp":120}', fooder_likes: '["r1"]', fooder_friends: '[]', fooder_achievements: '["a"]',
        fooder_preferences: '{"craving":"surprise"}', fooder_me: '{"id":"u1"}',
      };
      for (const [k, v] of Object.entries(kept)) storage.setItem(k, v);
      storage.setItem('fooder_onboarding_done', '1');
      storage.setItem('fooder_profile', '{"pseudo":"Riyan"}');
      storage.setItem(ONBOARDING_DRAFT_KEY, '{"step":"age"}');

      resetOnboardingForReplay();

      expect(storage.getItem('fooder_onboarding_done')).toBeNull();
      expect(storage.getItem('fooder_profile')).toBeNull();
      expect(storage.getItem(ONBOARDING_DRAFT_KEY)).toBeNull();
      for (const [k, v] of Object.entries(kept)) expect(storage.getItem(k), k).toBe(v);
    });

    it('sans le paramètre, un inscrit reste inscrit (pas de reset implicite)', async () => {
      const { hasCompletedOnboarding } = await import('../lib/profile');
      storage.setItem('fooder_onboarding_done', '1');
      if (wantsReplay('')) resetOnboardingForReplay();
      expect(hasCompletedOnboarding()).toBe(true);
      if (wantsReplay('?rejouer=1')) resetOnboardingForReplay();
      expect(hasCompletedOnboarding()).toBe(false);
    });

    it('ne plante pas si le stockage est indisponible', () => {
      vi.stubGlobal('localStorage', { removeItem: () => { throw new Error('denied'); } });
      expect(() => resetOnboardingForReplay()).not.toThrow();
    });
  });
});
