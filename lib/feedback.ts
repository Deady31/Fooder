/**
 * Retours sensoriels centralisés : vibrations (motifs distincts par intention) et petit son optionnel.
 * Réglages lus dans lib/store (`fooder_feedback`) : vibrations actives par défaut, son coupé par défaut.
 * iOS Safari n'a pas `navigator.vibrate` : `haptic` renvoie alors false et l'UI garde son retour visuel.
 */
import { readJson, writeJson } from './store';

export type HapticKind = 'tap' | 'like' | 'success' | 'level' | 'error' | 'jackpot';

export const HAPTIC_PATTERNS: Record<HapticKind, readonly number[]> = {
  tap: [8],
  like: [14, 40, 22],
  success: [20, 50, 20, 50, 40],
  level: [30, 40, 60, 40, 120],
  error: [70, 60, 70],
  jackpot: [80, 40, 80, 40, 200],
};

export const FEEDBACK_KEY = 'fooder_feedback';

export interface FeedbackPrefs {
  haptics: boolean;
  sound: boolean;
}

export const DEFAULT_FEEDBACK: FeedbackPrefs = { haptics: true, sound: false };

export function readFeedbackPrefs(): FeedbackPrefs {
  const raw = readJson<unknown>(FEEDBACK_KEY, null);
  if (typeof raw !== 'object' || raw === null) return DEFAULT_FEEDBACK;
  const r = raw as Record<string, unknown>;
  return {
    haptics: typeof r.haptics === 'boolean' ? r.haptics : DEFAULT_FEEDBACK.haptics,
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_FEEDBACK.sound,
  };
}

export function writeFeedbackPrefs(patch: Partial<FeedbackPrefs>): FeedbackPrefs {
  const next = { ...readFeedbackPrefs(), ...patch };
  writeJson(FEEDBACK_KEY, next);
  return next;
}

/** Vibre selon l'intention. Renvoie true si la vibration a été demandée au système. */
export function haptic(kind: HapticKind): boolean {
  if (!readFeedbackPrefs().haptics) return false;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate([...HAPTIC_PATTERNS[kind]]) !== false;
  } catch {
    return false;
  }
}

/** Notes (Hz) jouées en arpège très court ; seulement si l'utilisateur a activé le son. */
const CHIMES: Record<HapticKind, readonly number[]> = {
  tap: [880],
  like: [660, 880],
  success: [660, 880, 1100],
  level: [523, 659, 784, 1047],
  error: [220, 196],
  jackpot: [784, 988, 1175, 1568],
};

type AudioCtor = typeof AudioContext;
let audio: AudioContext | null = null;

/** Petit son de 30 à 60 ms par note (Web Audio, aucun fichier). Renvoie true s'il a été joué. */
export function chime(kind: HapticKind): boolean {
  if (!readFeedbackPrefs().sound || typeof window === 'undefined') return false;
  try {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return false;
    audio = audio ?? new Ctor();
    const ctx = audio;
    const start = ctx.currentTime;
    CHIMES[kind].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + i * 0.06;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    });
    return true;
  } catch {
    return false;
  }
}

/** Vibration + son (si activé) pour une même intention. */
export function feedback(kind: HapticKind): void {
  haptic(kind);
  chime(kind);
}
