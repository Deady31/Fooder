/** XP des photos de plats : logique pure (le stockage et l'attribution sont dans lib/rewards.ts). */

export const PHOTO_XP_FIRST = 30;
export const PHOTO_XP_REPEAT = 10;
export const PHOTO_DAILY_CAP = 3;
export const PHOTOGRAPHER_TARGET = 5;
export const PHOTO_XP_KEY = 'fooder_photo_xp';

const MAX_REMEMBERED = 500;

export interface PhotoXpState {
  /** Restos déjà récompensés pour une photo (une seule fois par resto). */
  rewarded: string[];
  /** Jour de Paris (AAAA-MM-JJ) auquel se rapporte `today`. */
  day: string;
  /** Récompenses de photo déjà données ce jour-là. */
  today: number;
  /** Photos de plats publiées au total (succès « Photographe »). */
  posted: number;
}

export const EMPTY_PHOTO_XP: PhotoXpState = { rewarded: [], day: '', today: 0, posted: 0 };

export type PhotoRewardReason = 'first' | 'repeat' | 'no_photo' | 'already_rewarded' | 'daily_cap';

export interface PhotoRewardInput {
  restId: string;
  hasPhoto: boolean;
  /** Nombre de photos communautaires connues pour ce resto AVANT cette publication. */
  knownPhotos: number;
  now: number;
}

export interface PhotoRewardResult {
  xp: number;
  reason: PhotoRewardReason;
  state: PhotoXpState;
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Jour calendaire à Paris, au format AAAA-MM-JJ. */
export function parisDay(now: number): string {
  return dayFormat.format(new Date(now));
}

/** Relit un état stocké en tolérant n'importe quelle valeur. */
export function normalizePhotoXp(raw: unknown): PhotoXpState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PHOTO_XP;
  const r = raw as Record<string, unknown>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return {
    rewarded: Array.isArray(r.rewarded) ? r.rewarded.filter((x): x is string => typeof x === 'string') : [],
    day: typeof r.day === 'string' ? r.day : '',
    today: count(r.today),
    posted: count(r.posted),
  };
}

/** Règles : +30 XP si aucune photo communautaire connue, sinon +10 ; 1 récompense par resto ; 3 par jour de Paris ; rien sans photo. */
export function computePhotoReward(state: PhotoXpState, input: PhotoRewardInput): PhotoRewardResult {
  if (!input.hasPhoto) return { xp: 0, reason: 'no_photo', state };
  const day = parisDay(input.now);
  const today = state.day === day ? state.today : 0;
  const posted = state.posted + 1;

  if (state.rewarded.includes(input.restId)) return { xp: 0, reason: 'already_rewarded', state: { ...state, day, today, posted } };
  if (today >= PHOTO_DAILY_CAP) return { xp: 0, reason: 'daily_cap', state: { ...state, day, today, posted } };

  const first = input.knownPhotos <= 0;
  return {
    xp: first ? PHOTO_XP_FIRST : PHOTO_XP_REPEAT,
    reason: first ? 'first' : 'repeat',
    state: { rewarded: [...state.rewarded, input.restId].slice(-MAX_REMEMBERED), day, today: today + 1, posted },
  };
}

export function photoRewardMessage(xp: number): string | null {
  return xp > 0 ? `+${xp} XP : ta photo aide les autres !` : null;
}
