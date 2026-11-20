import { readJson, writeJson } from './store';

/**
 * Tour guidé dans l'appli (après l'onboarding) : 4 gestes sur de vraies cartes.
 * Ici : l'état et son réducteur (purs, testés), la persistance et le bus d'événements.
 * Le dessin (assombri, flèche, bulle) est dans components/tour.
 */
export const TOUR_KEY = 'fooder_tour';

export type TourStepId = 'mood' | 'swipe' | 'favoris' | 'fil';
export const TOUR_STEPS: readonly TourStepId[] = ['mood', 'swipe', 'favoris', 'fil'];

/** Swipes visés pour un premier portrait Food DNA (jauge de fin de tour). */
export const DNA_SWIPE_GOAL = 10;
/** XP offerte à la fin du tour (une seule fois). */
export const TOUR_XP = 20;

export type TourStatus = 'idle' | 'active' | 'done' | 'skipped';

export interface TourState {
  status: TourStatus;
  /** Index dans TOUR_STEPS. */
  step: number;
  /** Étape « swipe » : sens déjà essayés. */
  left: boolean;
  right: boolean;
  /** Étape « favoris » : l'onglet a été touché, on montre le resto rangé. */
  favoritesOpened: boolean;
}

export const IDLE_TOUR: TourState = { status: 'idle', step: 0, left: false, right: false, favoritesOpened: false };
export const FRESH_TOUR: TourState = { ...IDLE_TOUR, status: 'active' };

export type TourEvent =
  | { type: 'start' }
  | { type: 'mood' }
  | { type: 'swipe'; dir: 'left' | 'right' }
  | { type: 'route'; path: string }
  | { type: 'next' }
  | { type: 'skipStep' }
  | { type: 'skip' };

export const tourStepId = (s: TourState): TourStepId => TOUR_STEPS[Math.min(s.step, TOUR_STEPS.length - 1)];
export const isTourActive = (s: TourState): boolean => s.status === 'active';

function advance(s: TourState): TourState {
  if (s.step >= TOUR_STEPS.length - 1) return { ...s, status: 'done' };
  return { ...s, step: s.step + 1 };
}

/** Réducteur : un événement hors de propos pour l'étape courante est ignoré (jamais d'erreur, jamais de blocage). */
export function reduceTour(s: TourState, e: TourEvent): TourState {
  if (e.type === 'start') return FRESH_TOUR;
  if (s.status !== 'active') return s;
  if (e.type === 'skip') return { ...s, status: 'skipped' };
  if (e.type === 'skipStep') return advance(s);

  switch (tourStepId(s)) {
    case 'mood':
      return e.type === 'mood' ? advance(s) : s;
    case 'swipe': {
      if (e.type !== 'swipe') return s;
      const next = { ...s, left: s.left || e.dir === 'left', right: s.right || e.dir === 'right' };
      return next.left && next.right ? advance(next) : next;
    }
    case 'favoris':
      if (!s.favoritesOpened) return e.type === 'route' && e.path === '/wishlist' ? { ...s, favoritesOpened: true } : s;
      return e.type === 'next' ? advance(s) : s;
    case 'fil':
      return e.type === 'route' && e.path === '/feed' ? advance(s) : s;
  }
}

/** Relit un état stocké en tolérant n'importe quelle valeur. */
export function normalizeTour(raw: unknown): TourState {
  if (typeof raw !== 'object' || raw === null) return IDLE_TOUR;
  const r = raw as Record<string, unknown>;
  const status: TourStatus = r.status === 'active' || r.status === 'done' || r.status === 'skipped' ? r.status : 'idle';
  const step = typeof r.step === 'number' && Number.isInteger(r.step) ? Math.min(Math.max(r.step, 0), TOUR_STEPS.length - 1) : 0;
  return { status, step, left: r.left === true, right: r.right === true, favoritesOpened: r.favoritesOpened === true };
}

export function readTour(): TourState {
  return normalizeTour(readJson<unknown>(TOUR_KEY, null));
}

export function writeTour(s: TourState): void {
  writeJson(TOUR_KEY, s);
}

/** Jauge de fin de tour : swipes faits sur l'objectif. */
export function dnaProgress(swipes: number): { done: number; goal: number; left: number; ratio: number } {
  const done = Math.max(0, Math.min(DNA_SWIPE_GOAL, Math.floor(swipes)));
  return { done, goal: DNA_SWIPE_GOAL, left: DNA_SWIPE_GOAL - done, ratio: done / DNA_SWIPE_GOAL };
}

// ── Bus d'événements (la page émet, l'hôte du tour écoute) ─────────────────────────────────────────

const BUS_EVENT = 'fooder:tour';

export function emitTour(event: TourEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TourEvent>(BUS_EVENT, { detail: event }));
}

export function subscribeTour(cb: (event: TourEvent) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<TourEvent>).detail);
  window.addEventListener(BUS_EVENT, handler);
  return () => window.removeEventListener(BUS_EVENT, handler);
}

/** Démarre (ou rejoue) le tour : état enregistré, puis l'hôte le prend en compte. */
export function startTour(): void {
  writeTour(FRESH_TOUR);
  emitTour({ type: 'start' });
}
