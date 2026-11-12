import { readJson, writeJson } from './store';
import { renameMe } from './identity';
import { validatePseudo } from './pseudo';
import { QUARTIERS } from './quartiers';
import type { StickerName } from './stickers';
import type { Diet } from '../data/mockRestaurants';

/* ── Types ───────────────────────────────────────────────────────── */

/** Même type que les fiches et le filtre de régime (une seule définition, dans data/mockRestaurants). */
export type { Diet };
export type Gender = 'female' | 'male' | 'other' | 'unspecified';
export type AgeRange = 'u18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';
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
  /** Ids de CUISINE_OPTIONS, par ordre de choix */
  cuisines: string[];
  diets: Diet[];
  budget: BudgetLevel | null;
  vibes: Vibe[];
  frequency: Frequency | null;
  aversions: Aversion[];
  quartier: string | null;
  companions: Companion | null;
  completedAt: number;
}

export const PROFILE_KEY = 'fooder_profile';
export const PROFILE_VERSION = 1;
export const MAX_CUISINES = 6;

export const DIETS: readonly Diet[] = ['vegan', 'vegetarian', 'halal', 'gluten_free'];
export const GENDERS: readonly Gender[] = ['female', 'male', 'other', 'unspecified'];
export const AGE_RANGES: readonly AgeRange[] = ['u18', '18_24', '25_34', '35_44', '45_54', '55_plus'];
export const BUDGETS: readonly BudgetLevel[] = [1, 2, 3];
export const VIBES: readonly Vibe[] = ['calm', 'festive', 'romantic', 'friends', 'quick', 'terrace'];
export const FREQUENCIES: readonly Frequency[] = ['rarely', 'monthly', 'weekly', 'often'];
export const AVERSIONS: readonly Aversion[] = ['raw_fish', 'spicy', 'seafood', 'offal', 'cilantro', 'other'];
export const COMPANIONS: readonly Companion[] = ['solo', 'couple', 'friends', 'family', 'colleagues'];

/* ── Cuisines ────────────────────────────────────────────────────── */

/** Humeurs historiques lues par la page swipe (voir MOOD_FILTERS). */
export type MoodId = 'surprise' | 'asie' | 'terroir' | 'street' | 'veggie' | 'gros' | 'special' | 'brunch';

export interface CuisineOption {
  id: string;
  label: string;
  sticker: StickerName;
  mood: MoodId | null;
}

export const CUISINE_OPTIONS: readonly CuisineOption[] = [
  { id: 'italien', label: 'Italien', sticker: 'pasta', mood: null },
  { id: 'pizza', label: 'Pizza', sticker: 'pizza', mood: 'street' },
  { id: 'francais', label: 'Français', sticker: 'french', mood: 'terroir' },
  { id: 'bistrot', label: 'Bistrot', sticker: 'bistro', mood: 'terroir' },
  { id: 'burger', label: 'Burger', sticker: 'burger', mood: 'street' },
  { id: 'kebab', label: 'Kebab', sticker: 'kebab', mood: 'street' },
  { id: 'libanais', label: 'Libanais', sticker: 'mezze', mood: null },
  { id: 'japonais', label: 'Japonais', sticker: 'sushi', mood: 'asie' },
  { id: 'ramen', label: 'Ramen', sticker: 'ramen', mood: 'asie' },
  { id: 'chinois', label: 'Chinois', sticker: 'chinese', mood: 'asie' },
  { id: 'thai', label: 'Thaï', sticker: 'thai', mood: 'asie' },
  { id: 'coreen', label: 'Coréen', sticker: 'korean', mood: 'asie' },
  { id: 'vietnamien', label: 'Vietnamien', sticker: 'vietnam', mood: 'asie' },
  { id: 'indien', label: 'Indien', sticker: 'curry', mood: 'asie' },
  { id: 'marocain', label: 'Marocain', sticker: 'tagine', mood: null },
  { id: 'africain', label: 'Africain', sticker: 'african', mood: null },
  { id: 'mexicain', label: 'Mexicain', sticker: 'taco', mood: 'street' },
  { id: 'crepes', label: 'Crêpes', sticker: 'crepe', mood: 'brunch' },
  { id: 'mer', label: 'Fruits de mer', sticker: 'seafood', mood: null },
  { id: 'tapas', label: 'Tapas', sticker: 'tapas', mood: null },
  { id: 'brunch', label: 'Brunch', sticker: 'brunch', mood: 'brunch' },
  { id: 'salade', label: 'Salades', sticker: 'salad', mood: 'veggie' },
  { id: 'cafe', label: 'Café', sticker: 'coffee', mood: 'brunch' },
  { id: 'desserts', label: 'Desserts', sticker: 'icecream', mood: 'brunch' },
];

const CUISINE_IDS = new Set(CUISINE_OPTIONS.map(c => c.id));

/* ── Compatibilité avec l'ancien onboarding (fooder_preferences) ─── */

const MOOD_LABELS: Record<MoodId, string> = {
  surprise: 'Surprends-moi',
  asie: 'Tour en Asie',
  terroir: 'Terroir & bistrots',
  street: 'Street & Fast',
  veggie: 'Vert & sain',
  gros: "J'ai VRAIMENT faim",
  special: 'Soirée spéciale',
  brunch: 'Slow morning',
};

const MOOD_FILTER_LABELS: Record<MoodId, string> = {
  asie: 'Asiatique', terroir: 'Français', street: 'Street Food', veggie: 'Veggie', gros: 'All',
  special: 'Gastronomique', brunch: 'Brunch & Café', surprise: 'Surprends-moi',
};

/** Budget max par personne (€) correspondant à chaque niveau, au format de l'ancien sélecteur. */
const BUDGET_EUROS: Record<BudgetLevel, number> = { 1: 20, 2: 35, 3: 70 };
const DEFAULT_BUDGET_EUROS = 35;

/** Humeur dominante des cuisines choisies ; « surprise » si aucune ne l'emporte nettement. */
export function deriveCraving(cuisineIds: readonly string[]): MoodId {
  const counts = new Map<MoodId, number>();
  for (const id of cuisineIds) {
    const mood = CUISINE_OPTIONS.find(c => c.id === id)?.mood;
    if (mood) counts.set(mood, (counts.get(mood) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'surprise';
  const [topMood, topCount] = ranked[0];
  const tied = ranked.length > 1 && ranked[1][1] === topCount;
  return !tied && topCount * 2 >= cuisineIds.length ? topMood : 'surprise';
}

/** Préférences au format lu par la page swipe, en conservant les champs déjà présents. */
export function toLegacyPreferences(profile: Profile, existing: Record<string, unknown>): Record<string, unknown> {
  const craving = deriveCraving(profile.cuisines);
  return {
    ...existing,
    budget: profile.budget ? BUDGET_EUROS[profile.budget] : DEFAULT_BUDGET_EUROS,
    craving,
    cravingLabel: MOOD_LABELS[craving],
    cuisineFilter: MOOD_FILTER_LABELS[craving],
    cuisines: [...profile.cuisines],
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

function sanitize(raw: unknown, completedAt: number): Profile | null {
  if (!isRecord(raw)) return null;
  const pseudo = validatePseudo(raw.pseudo);
  if (!pseudo.ok) return null;
  const quartierNames = QUARTIERS.map(q => q.name);
  return {
    version: PROFILE_VERSION,
    pseudo: pseudo.value,
    gender: oneOf(GENDERS, raw.gender) ?? 'unspecified',
    ageRange: oneOf(AGE_RANGES, raw.ageRange),
    cuisines: listOf(Array.from(CUISINE_IDS), raw.cuisines, MAX_CUISINES),
    diets: listOf(DIETS, raw.diets),
    budget: oneOf(BUDGETS, raw.budget),
    vibes: listOf(VIBES, raw.vibes),
    frequency: oneOf(FREQUENCIES, raw.frequency),
    aversions: listOf(AVERSIONS, raw.aversions),
    quartier: oneOf(quartierNames, raw.quartier),
    companions: oneOf(COMPANIONS, raw.companions),
    completedAt: typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt) ? raw.completedAt : completedAt,
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

/**
 * Termine l'inscription : profil, pseudo affiché, préférences historiques (deck) et drapeau
 * « onboarding terminé ». Retourne false si le profil n'a pas pu être écrit.
 */
export function completeOnboarding(profile: Profile): boolean {
  if (!writeProfile(profile)) return false;
  renameMe(profile.pseudo);
  const existing = readJson<unknown>(PREFS_KEY, {});
  writeJson(PREFS_KEY, toLegacyPreferences(profile, isRecord(existing) ? existing : {}));
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    return false;
  }
  return true;
}
