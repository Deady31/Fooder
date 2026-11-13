import { readJson, writeJson } from './store';
import { AGE_RANGES, DIETS, EMAIL_MAX, GENDERS, ONBOARDING_DRAFT_KEY } from './profile';
import type { AgeRange, Diet, Gender } from './profile';

/** Parcours : accueil, pseudo, genre, âge, régime, « Tu nous aides », prêt. */
export const ONBOARDING_STEPS = ['welcome', 'pseudo', 'gender', 'age', 'diet', 'help', 'final'] as const;
export type StepId = (typeof ONBOARDING_STEPS)[number];

/** Réponses en cours de saisie (textes bruts : validés à la construction du profil). */
export interface OnboardingAnswers {
  pseudo: string;
  gender: Gender | null;
  ageRange: AgeRange | null;
  diets: Diet[];
  contactEmail: string;
}

export interface SavedDraft {
  step: StepId;
  answers: OnboardingAnswers;
}

export const EMPTY_ANSWERS: OnboardingAnswers = { pseudo: '', gender: null, ageRange: null, diets: [], contactEmail: '' };

const PSEUDO_DRAFT_MAX = 32;

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function pick<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return allowed.find(a => a === v) ?? null;
}

/** Nettoie un brouillon lu du stockage ; null si l'étape est inconnue (ex. brouillon d'un ancien parcours). */
export function parseDraft(raw: unknown): SavedDraft | null {
  if (!isRecord(raw)) return null;
  const step = ONBOARDING_STEPS.find(s => s === raw.step);
  if (!step) return null;
  const a = isRecord(raw.answers) ? raw.answers : {};
  const diets = Array.isArray(a.diets) ? DIETS.filter(d => (a.diets as unknown[]).includes(d)) : [];
  return {
    step,
    answers: {
      pseudo: text(a.pseudo, PSEUDO_DRAFT_MAX),
      gender: pick(GENDERS, a.gender),
      ageRange: pick(AGE_RANGES, a.ageRange),
      diets,
      contactEmail: text(a.contactEmail, EMAIL_MAX),
    },
  };
}

export function readDraft(): SavedDraft | null {
  return parseDraft(readJson<unknown>(ONBOARDING_DRAFT_KEY, null));
}

export function writeDraft(step: StepId, answers: OnboardingAnswers): boolean {
  return writeJson(ONBOARDING_DRAFT_KEY, { step, answers });
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    /* stockage indisponible : on ignore */
  }
}
