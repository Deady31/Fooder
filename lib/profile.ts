import { readJson, writeJson } from './store';
import { renameMe } from './identity';
import { validatePseudo } from './pseudo';
import { QUARTIERS } from './quartiers';
import { TERMS_FALLBACK_KEY, createAcceptance, sanitizeTermsAcceptance } from './legal';
import type { TermsAcceptance } from './legal';
import type { Diet } from '../data/mockRestaurants';

/* ── Types ───────────────────────────────────────────────────────── */

/** Même type que les fiches et le filtre de régime (une seule définition, dans data/mockRestaurants). */
export type { Diet };
export type Gender = 'female' | 'male' | 'other' | 'unspecified';
export type AgeRange = 'u18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';
/** Types des anciennes questions (onboarding en 13 étapes), conservés pour relire les profils déjà enregistrés. */
export type BudgetLevel = 1 | 2 | 3;
export type Vibe = 'calm' | 'festive' | 'romantic' | 'friends' | 'quick' | 'terrace';
export type Frequency = 'rarely' | 'monthly' | 'weekly' | 'often';
export type Aversion = 'raw_fish' | 'spicy' | 'seafood' | 'offal' | 'cilantro' | 'other';
export type Companion = 'solo' | 'couple' | 'friends' | 'family' | 'colleagues';

export interface Profile {
  version: number;
  pseudo: string;
  gender: Gender;
  ageRange: AgeRange | null;
  diets: Diet[];
  /** E-mail facultatif, jamais envoyé à un service d'authentification : stocké en local, synchronisé avec le profil. */
  contactEmail?: string | null;
  completedAt: number;
  /** Conditions acceptées : date ISO et version (absents pour un profil créé avant l'acceptation obligatoire). */
  termsAcceptedAt?: string;
  termsVersion?: string;
  /* Champs hérités de l'ancien onboarding : lus s'ils existent, jamais écrits par le nouveau parcours. */
  /** Anciens ids de cuisines, par ordre de choix */
  cuisines?: string[];
  budget?: BudgetLevel | null;
  vibes?: Vibe[];
  frequency?: Frequency | null;
  aversions?: Aversion[];
  quartier?: string | null;
  companions?: Companion | null;
}

export const PROFILE_KEY = 'fooder_profile';
export const PROFILE_VERSION = 1;
/** Brouillon de l'inscription en cours (local uniquement, non synchronisé). */
export const ONBOARDING_DRAFT_KEY = 'fooder_onboarding_draft';

const LEGACY_MAX_CUISINES = 6;
const LEGACY_CUISINE_ID_MAX = 40;

export const DIETS: readonly Diet[] = ['vegan', 'vegetarian', 'halal', 'gluten_free'];
export const GENDERS: readonly Gender[] = ['female', 'male', 'other', 'unspecified'];
export const AGE_RANGES: readonly AgeRange[] = ['u18', '18_24', '25_34', '35_44', '45_54', '55_plus'];
const BUDGETS: readonly BudgetLevel[] = [1, 2, 3];
const VIBES: readonly Vibe[] = ['calm', 'festive', 'romantic', 'friends', 'quick', 'terrace'];
const FREQUENCIES: readonly Frequency[] = ['rarely', 'monthly', 'weekly', 'often'];
const AVERSIONS: readonly Aversion[] = ['raw_fish', 'spicy', 'seafood', 'offal', 'cilantro', 'other'];
const COMPANIONS: readonly Companion[] = ['solo', 'couple', 'friends', 'family', 'colleagues'];

/* ── E-mail facultatif ───────────────────────────────────────────── */

export const EMAIL_MAX = 254;

export type EmailRefusal = 'invalid' | 'too_long';

export type EmailResult =
  | { ok: true; value: string | null; reason?: undefined }
  | { ok: false; reason: EmailRefusal; value?: undefined };

export const EMAIL_MESSAGES: Record<EmailRefusal, string> = {
  invalid: 'Cet e-mail ne ressemble pas à une adresse. Corrige-le ou passe cette étape.',
  too_long: 'Cette adresse est trop longue. Corrige-la ou passe cette étape.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** Validation légère : vide = accepté (facultatif, valeur null) ; sinon format « x@y.zz », trim + minuscules. */
export function validateEmail(raw: unknown): EmailResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid' };
  const value = raw.trim().toLowerCase();
  if (value === '') return { ok: true, value: null };
  if (value.length > EMAIL_MAX) return { ok: false, reason: 'too_long' };
  return EMAIL_PATTERN.test(value) ? { ok: true, value } : { ok: false, reason: 'invalid' };
}

/* ── Préférences du deck (fooder_preferences) ────────────────────── */

/** Budget max neutre (€) : le plus haut cran du curseur de filtre, donc aucun restaurant n'est écarté. */
export const NEUTRAL_BUDGET_EUROS = 150;

/**
 * Préférences au format lu par la page swipe : humeur « Surprends-moi », aucun filtre de cuisine, budget non limitant.
 * Les goûts s'apprennent ensuite par les swipes. Les autres champs déjà présents sont conservés.
 */
export function neutralPreferences(existing: Record<string, unknown>): Record<string, unknown> {
  return {
    ...existing,
    budget: NEUTRAL_BUDGET_EUROS,
    craving: 'surprise',
    cravingLabel: 'Surprends-moi',
    cuisineFilter: 'All',
    cuisines: [],
  };
}

/* ── Nettoyage défensif ──────────────────────────────────────────── */

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function oneOf<T extends string | number>(allowed: readonly T[], v: unknown): T | null {
  return allowed.find(a => a === v) ?? null;
}

function listOf<T extends string>(allowed: readonly T[], v: unknown, max = Infinity): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    const ok = oneOf(allowed, item);
    if (ok !== null && !out.includes(ok)) out.push(ok);
    if (out.length >= max) break;
  }
  return out;
}

function legacyCuisines(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || item === '' || item.length > LEGACY_CUISINE_ID_MAX || out.includes(item)) continue;
    out.push(item);
    if (out.length >= LEGACY_MAX_CUISINES) break;
  }
  return out;
}

/** Anciens champs : repris seulement s'ils existent dans l'entrée (un profil neuf n'en contient aucun). */
function legacyFields(raw: Record<string, unknown>): Partial<Profile> {
  const quartierNames = QUARTIERS.map(q => q.name);
  const out: Partial<Profile> = {};
  if (raw.cuisines !== undefined) out.cuisines = legacyCuisines(raw.cuisines);
  if (raw.budget !== undefined) out.budget = oneOf(BUDGETS, raw.budget);
  if (raw.vibes !== undefined) out.vibes = listOf(VIBES, raw.vibes);
  if (raw.frequency !== undefined) out.frequency = oneOf(FREQUENCIES, raw.frequency);
  if (raw.aversions !== undefined) out.aversions = listOf(AVERSIONS, raw.aversions);
  if (raw.quartier !== undefined) out.quartier = oneOf(quartierNames, raw.quartier);
  if (raw.companions !== undefined) out.companions = oneOf(COMPANIONS, raw.companions);
  return out;
}

function sanitize(raw: unknown, completedAt: number): Profile | null {
  if (!isRecord(raw)) return null;
  const pseudo = validatePseudo(raw.pseudo);
  if (!pseudo.ok) return null;
  const email = validateEmail(raw.contactEmail);
  return {
    version: PROFILE_VERSION,
    pseudo: pseudo.value,
    gender: oneOf(GENDERS, raw.gender) ?? 'unspecified',
    ageRange: oneOf(AGE_RANGES, raw.ageRange),
    diets: listOf(DIETS, raw.diets),
    contactEmail: email.ok ? email.value : null,
    completedAt: typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt) ? raw.completedAt : completedAt,
    ...(sanitizeTermsAcceptance(raw) ?? {}),
    ...legacyFields(raw),
  };
}

/** Construit un profil à partir du brouillon de l'inscription ; null si le pseudo est refusé. */
export function buildProfile(draft: Record<string, unknown>, now: number = Date.now()): Profile | null {
  return sanitize({ ...draft, completedAt: now }, now);
}

/** Relit un profil stocké, quelle que soit sa version ; null s'il est inutilisable. */
export function migrateProfile(raw: unknown): Profile | null {
  return sanitize(raw, Date.now());
}

/* ── Stockage ────────────────────────────────────────────────────── */

const PREFS_KEY = 'fooder_preferences';
const DONE_KEY = 'fooder_onboarding_done';

export function readProfile(): Profile | null {
  return migrateProfile(readJson<unknown>(PROFILE_KEY, null));
}

export function writeProfile(profile: Profile): boolean {
  return writeJson(PROFILE_KEY, profile);
}

/** Vrai pour un profil existant ou pour qui a terminé l'ancien onboarding. */
export function hasCompletedOnboarding(): boolean {
  try {
    if (localStorage.getItem(DONE_KEY)) return true;
  } catch {
    return false;
  }
  return readProfile() !== null;
}

function clearOnboardingDraft(): void {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    /* stockage indisponible : on ignore */
  }
}

/**
 * Termine l'inscription : profil, pseudo affiché, préférences du deck (neutres), drapeau
 * « onboarding terminé » et effacement du brouillon. Retourne false si le profil n'a pas pu être écrit.
 */
export function completeOnboarding(profile: Profile): boolean {
  if (!writeProfile(profile)) return false;
  renameMe(profile.pseudo);
  const existing = readJson<unknown>(PREFS_KEY, {});
  writeJson(PREFS_KEY, neutralPreferences(isRecord(existing) ? existing : {}));
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    return false;
  }
  clearOnboardingDraft();
  return true;
}

/* ── Conditions d'utilisation acceptées ──────────────────────────── */

/** Acceptation mémorisée : celle du profil (synchronisé), sinon le repli local. */
export function readTermsAcceptance(): TermsAcceptance | null {
  const profile = readProfile();
  if (profile) return sanitizeTermsAcceptance(profile);
  return sanitizeTermsAcceptance(readJson<unknown>(TERMS_FALLBACK_KEY, null));
}

/** Enregistre l'acceptation de la version courante dans le profil (ou, à défaut de profil, dans le repli local). */
export function recordTermsAcceptance(now: number = Date.now()): boolean {
  const acceptance = createAcceptance(now);
  const profile = readProfile();
  return profile ? writeProfile({ ...profile, ...acceptance }) : writeJson(TERMS_FALLBACK_KEY, acceptance);
}

/**
 * Relance l'inscription (outil de test, `/onboarding?rejouer=1`) : ne supprime que le drapeau, le profil et le brouillon.
 * XP, likes, amis, succès et préférences restent intacts.
 */
export function resetOnboardingForReplay(): void {
  try {
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    return;
  }
  clearOnboardingDraft();
}
