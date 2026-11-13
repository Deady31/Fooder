/**
 * Bus des célébrations (XP, niveau, succès, mission) et file d'affichage, en logique pure.
 * Les émetteurs (lib/rewards, lib/missions) ne connaissent pas l'UI ; `CelebrationHost` s'abonne et affiche.
 */

export type XpReason = 'swipe' | 'like' | 'visit' | 'photo' | 'friend' | 'group' | 'defi' | 'mission' | 'other';

export interface XpEvent { type: 'xp'; amount: number; total: number; reason: XpReason }
/** Un seul événement par appel d'awardXp, même si plusieurs niveaux sont franchis. */
export interface LevelEvent { type: 'level'; level: number; from: number; gained: number; total: number }
export interface AchievementEvent { type: 'achievement'; id: string; title: string; description: string }
export interface MissionEvent {
  type: 'mission';
  id: string;
  title: string;
  description: string;
  xpReward: number;
  /** Jour des missions (AAAA-MM-JJ, Paris) : une mission n'est célébrée qu'une fois par jour. */
  day: string;
  /** Missions terminées ce jour-là, celle-ci comprise. */
  done: number;
  total: number;
}

export type CelebrationEvent = XpEvent | LevelEvent | AchievementEvent | MissionEvent;
export type QueuedEvent = LevelEvent | AchievementEvent | MissionEvent;
export type CelebrationListener = (event: CelebrationEvent) => void;

// ── Bus ──────────────────────────────────────────────────────────────────────

/** Événements gardés tant que personne n'écoute (l'hôte se monte après les effets des pages). */
export const PENDING_MAX = 20;

const listeners = new Set<CelebrationListener>();
let pending: CelebrationEvent[] = [];

function deliver(listener: CelebrationListener, event: CelebrationEvent): void {
  try {
    listener(event);
  } catch {
    /* un affichage défaillant ne doit jamais casser l'attribution des récompenses */
  }
}

export function emitCelebration(event: CelebrationEvent): void {
  if (listeners.size === 0) {
    pending = [...pending, event].slice(-PENDING_MAX);
    return;
  }
  Array.from(listeners).forEach(l => deliver(l, event));
}

/** Abonne un écouteur ; le premier abonné reçoit aussi les événements en attente. Retourne le désabonnement. */
export function onCelebration(listener: CelebrationListener): () => void {
  listeners.add(listener);
  if (pending.length > 0) {
    const flush = pending;
    pending = [];
    flush.forEach(e => deliver(listener, e));
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Réservé aux tests. */
export function resetCelebrations(): void {
  listeners.clear();
  pending = [];
}

// ── File d'affichage ─────────────────────────────────────────────────────────

/** Pause entre deux éléments affichés, en ms. */
export const GAP_MS = 250;
const SEEN_MAX = 200;

export const PRIORITY: Record<QueuedEvent['type'], number> = { level: 3, achievement: 2, mission: 2 };

export interface QueueItem { key: string; event: QueuedEvent; seq: number }

export interface CelebrationQueue {
  current: QueueItem | null;
  queue: QueueItem[];
  /** Vrai pendant la pause qui suit un élément terminé. */
  resting: boolean;
  seq: number;
  /** Clés déjà prises en charge : un même succès n'est jamais affiché deux fois. */
  seen: string[];
}

export const EMPTY_QUEUE: CelebrationQueue = { current: null, queue: [], resting: false, seq: 0, seen: [] };

export type QueueAction =
  | { type: 'enqueue'; event: QueuedEvent }
  | { type: 'done' }
  | { type: 'advance' };

export function celebrationKey(e: CelebrationEvent): string {
  switch (e.type) {
    case 'level': return `level:${e.level}`;
    case 'achievement': return `achievement:${e.id}`;
    case 'mission': return `mission:${e.day}:${e.id}`;
    default: return `xp:${e.total}`;
  }
}

function insertByPriority(queue: QueueItem[], item: QueueItem): QueueItem[] {
  const p = PRIORITY[item.event.type];
  const at = queue.findIndex(q => PRIORITY[q.event.type] < p);
  return at < 0 ? [...queue, item] : [...queue.slice(0, at), item, ...queue.slice(at)];
}

function enqueue(state: CelebrationQueue, event: QueuedEvent): CelebrationQueue {
  if (!(event.type in PRIORITY)) return state;
  const key = celebrationKey(event);
  if (state.seen.includes(key)) return state;
  const seen = [...state.seen, key].slice(-SEEN_MAX);
  const seq = state.seq + 1;

  // Deux passages de niveau en attente : un seul écran, niveau final et total des niveaux gagnés.
  const waitingLevel = event.type === 'level' ? state.queue.find(q => q.event.type === 'level') : undefined;
  if (event.type === 'level' && waitingLevel && waitingLevel.event.type === 'level') {
    const prev = waitingLevel.event;
    const merged: LevelEvent = {
      ...event,
      level: Math.max(prev.level, event.level),
      from: Math.min(prev.from, event.from),
      gained: Math.max(prev.level, event.level) - Math.min(prev.from, event.from),
      total: Math.max(prev.total, event.total),
    };
    const item = { key: celebrationKey(merged), event: merged, seq: waitingLevel.seq };
    return { ...state, seq, seen, queue: state.queue.map(q => (q === waitingLevel ? item : q)) };
  }

  const item: QueueItem = { key, event, seq };
  if (!state.current && !state.resting && state.queue.length === 0) return { ...state, seq, seen, current: item };
  return { ...state, seq, seen, queue: insertByPriority(state.queue, item) };
}

/** Réducteur pur : `enqueue` ajoute, `done` termine l'élément affiché (pause), `advance` passe au suivant. */
export function queueReducer(state: CelebrationQueue, action: QueueAction): CelebrationQueue {
  switch (action.type) {
    case 'enqueue':
      return enqueue(state, action.event);
    case 'done':
      return state.current ? { ...state, current: null, resting: true } : state;
    case 'advance': {
      if (state.current) return state;
      const [next, ...rest] = state.queue;
      return next ? { ...state, current: next, queue: rest, resting: false } : { ...state, resting: false };
    }
    default:
      return state;
  }
}

// ── Bulles d'XP ──────────────────────────────────────────────────────────────

/** Les gains rapprochés de moins de 800 ms s'additionnent dans la même bulle (« +20 »). */
export const XP_COALESCE_MS = 800;

export interface XpBubble {
  id: number;
  amount: number;
  /** Valeur affichée avant ce gain (le compteur anime from → amount). */
  from: number;
  total: number;
  at: number;
}

export function coalesceXp(prev: XpBubble | null, e: XpEvent, now: number, windowMs: number = XP_COALESCE_MS): XpBubble {
  if (prev && now - prev.at < windowMs) {
    return { id: prev.id, amount: prev.amount + e.amount, from: prev.amount, total: e.total, at: now };
  }
  return { id: (prev?.id ?? 0) + 1, amount: e.amount, from: 0, total: e.total, at: now };
}

// ── Annonces ─────────────────────────────────────────────────────────────────

export function announceFor(e: CelebrationEvent): string {
  switch (e.type) {
    case 'xp': return `+${e.amount} XP`;
    case 'level': return `Niveau ${e.level} atteint !`;
    case 'achievement': return `Trophée débloqué : ${e.title}`;
    case 'mission': return `Mission accomplie : ${e.title}, +${e.xpReward} XP`;
    default: return '';
  }
}
