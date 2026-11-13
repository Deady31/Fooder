/**
 * Missions du jour : logique pure (choix, progression, versement unique) et attribution via lib/store + lib/rewards.
 * `hooks/useMissions` n'est qu'un adaptateur React autour de `progressMission`.
 */
import { readJson, writeJson } from './store';
import { awardXp } from './rewards';
import { emitCelebration } from './celebrations';
import { parisDay } from './photoXp';

export interface MissionLike {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  xpReward: number;
  current: number;
  completed: boolean;
}

export type Mission = MissionLike;
export type MissionTemplate = Omit<MissionLike, 'current' | 'completed'>;

export interface MissionState {
  /** Jour de Paris (AAAA-MM-JJ). */
  date: string;
  missions: Mission[];
  /** Missions dont l'XP a déjà été versée ce jour-là (garantit un seul versement). */
  rewarded: string[];
}

export const MISSIONS_KEY = 'fooder_missions';
export const DAILY_MISSIONS = 3;

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  { id: 'swipe_5', title: '5 restos explorés', description: 'Swipe 5 restaurants', emoji: '👆', target: 5, xpReward: 25 },
  { id: 'like_3', title: '3 coups de cœur', description: 'Like 3 restaurants', emoji: '❤️', target: 3, xpReward: 50 },
  { id: 'open_detail', title: 'Curieux gourmand', description: 'Consulte 1 détail resto', emoji: '📖', target: 1, xpReward: 15 },
  { id: 'swipe_10', title: 'Explorateur actif', description: 'Swipe 10 restaurants', emoji: '🗺️', target: 10, xpReward: 40 },
  { id: 'like_cheap', title: 'Bon plan trouvé', description: 'Like un resto < 15€', emoji: '💸', target: 1, xpReward: 30 },
  { id: 'dislike_5', title: 'Difficile à séduire', description: 'Passe 5 restaurants', emoji: '😤', target: 5, xpReward: 20 },
  { id: 'like_gastro', title: 'Gastronome', description: 'Like un resto > 50€', emoji: '🍷', target: 1, xpReward: 35 },
  { id: 'swipe_20', title: 'Swipe addict', description: 'Swipe 20 restaurants', emoji: '🔥', target: 20, xpReward: 60 },
];

/** Anciens ids de mission -> id actuel. */
const LEGACY_IDS: Record<string, string> = { like_premium: 'like_gastro' };

/** Convertit les ids obsolètes d'un jeu de missions déjà stocké (progression conservée, doublons retirés). */
export function migrateMissionIds<T extends MissionLike>(
  stored: readonly T[] | null | undefined,
  templates: readonly Omit<MissionLike, 'current' | 'completed'>[]
): T[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of stored) {
    const id = LEGACY_IDS[m.id] ?? m.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const tpl = id !== m.id ? templates.find(t => t.id === id) : undefined;
    out.push(id === m.id ? m : { ...m, ...(tpl ?? {}), id });
  }
  return out;
}

/** Jour des missions : calendrier de Paris, comme le plafond des photos. */
export function missionDay(now: number = Date.now()): string {
  return parisDay(now);
}

/** Tirage déterministe des 3 missions du jour (même algorithme qu'avant : un jour donne toujours le même trio). */
export function pickMissions(date: string): Mission[] {
  const seed = date.split('-').reduce((a, c) => a + (parseInt(c, 10) || 0), 0);
  const shuffled = [...MISSION_TEMPLATES].sort((a, b) => ((seed * a.id.length) % 11) - ((seed * b.id.length) % 11));
  return shuffled.slice(0, DAILY_MISSIONS).map(t => ({ ...t, current: 0, completed: false }));
}

function freshState(today: string): MissionState {
  return { date: today, missions: pickMissions(today), rewarded: [] };
}

const isMission = (m: unknown): m is Mission => {
  if (typeof m !== 'object' || m === null) return false;
  const r = m as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.target === 'number' && typeof r.current === 'number' && typeof r.xpReward === 'number';
};

/** Relit un état stocké : autre jour ou valeur invalide → nouvelles missions ; même jour → progression gardée et ids migrés. */
export function normalizeMissionState(raw: unknown, today: string): { state: MissionState; changed: boolean } {
  if (typeof raw !== 'object' || raw === null) return { state: freshState(today), changed: true };
  const r = raw as Record<string, unknown>;
  if (r.date !== today || !Array.isArray(r.missions)) return { state: freshState(today), changed: true };

  const valid = r.missions.filter(isMission);
  const missions = migrateMissionIds<Mission>(valid, MISSION_TEMPLATES);
  const legacyRewarded = !Array.isArray(r.rewarded);
  // Ancien format : une mission déjà terminée est considérée comme versée (jamais de double versement).
  const rawRewarded = legacyRewarded
    ? missions.filter(m => m.completed).map(m => m.id)
    : (r.rewarded as unknown[]).filter((x): x is string => typeof x === 'string').map(id => LEGACY_IDS[id] ?? id);
  const rewarded = Array.from(new Set(rawRewarded));

  const state: MissionState = { date: today, missions, rewarded };
  const changed =
    legacyRewarded ||
    valid.length !== r.missions.length ||
    JSON.stringify(missions) !== JSON.stringify(r.missions) ||
    JSON.stringify(rewarded) !== JSON.stringify(r.rewarded);
  return { state: changed ? state : (raw as MissionState), changed };
}

/**
 * Avance une mission (pur). `completed` n'est renvoyée qu'au moment où la mission se termine ET n'a jamais été versée ce jour.
 * Sans effet (mission absente, déjà terminée, montant invalide) : renvoie la même référence d'état.
 */
export function applyMissionProgress(state: MissionState, id: string, amount = 1): { state: MissionState; completed: Mission | null } {
  if (!Number.isFinite(amount) || amount <= 0) return { state, completed: null };
  const target = state.missions.find(m => m.id === id);
  if (!target || target.completed) return { state, completed: null };

  const current = Math.min(target.current + Math.floor(amount), target.target);
  if (current === target.current) return { state, completed: null };
  const done = current >= target.target;
  const updated: Mission = { ...target, current, completed: done };
  const missions = state.missions.map(m => (m.id === id ? updated : m));
  const firstPayout = done && !state.rewarded.includes(id);
  const rewarded = firstPayout ? [...state.rewarded, id] : state.rewarded;
  return { state: { ...state, missions, rewarded }, completed: firstPayout ? updated : null };
}

/** Lit l'état du jour (et l'écrit seulement s'il a fallu le créer, le migrer ou changer de jour). */
export function readMissionState(now: number = Date.now(), fallback: MissionState | null = null): MissionState {
  const { state, changed } = normalizeMissionState(readJson<unknown>(MISSIONS_KEY, fallback), missionDay(now));
  if (changed) writeJson(MISSIONS_KEY, state);
  return state;
}

export interface ProgressOptions {
  now?: number;
  /** État en mémoire si le stockage est indisponible (navigation privée stricte). */
  fallback?: MissionState | null;
}

/**
 * Fait progresser une mission : calcule hors de tout updater React, écrit via lib/store, puis,
 * si la mission vient d'être terminée, émet `mission` et verse `xpReward` (une seule fois par jour).
 */
export function progressMission(id: string, amount = 1, opts: ProgressOptions = {}): { state: MissionState; completed: Mission | null } {
  const now = opts.now ?? Date.now();
  const { state: base } = normalizeMissionState(readJson<unknown>(MISSIONS_KEY, opts.fallback ?? null), missionDay(now));
  const { state, completed } = applyMissionProgress(base, id, amount);
  if (state === base) return { state, completed: null };
  writeJson(MISSIONS_KEY, state);
  if (completed) {
    emitCelebration({
      type: 'mission',
      id: completed.id,
      title: completed.title,
      description: completed.description,
      xpReward: completed.xpReward,
      day: state.date,
      done: state.missions.filter(m => m.completed).length,
      total: state.missions.length,
    });
    awardXp(completed.xpReward, 'mission');
  }
  return { state, completed };
}
