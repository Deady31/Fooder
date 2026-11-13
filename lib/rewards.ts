import { pushNotification } from './notifications';
import { readJson, writeJson } from './store';
import { XpReason, emitCelebration } from './celebrations';
import {
  PHOTOGRAPHER_TARGET, PHOTO_XP_KEY, PhotoRewardReason, computePhotoReward, normalizePhotoXp, photoRewardMessage,
} from './photoXp';

// ── Données de progression (ré-exportées par hooks/useGamification pour compatibilité) ──

export const XP_KEY = 'fooder_xp';
export const ACH_KEY = 'fooder_achievements';

export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 5000];

export interface Achievement {
  id: string;
  title: string;
  emoji: string;
  description: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_swipe', title: 'Premier swipe !', emoji: '👆', description: 'Ton tout premier swipe' },
  { id: 'first_like', title: 'Coup de cœur', emoji: '❤️', description: 'Premier restaurant liké' },
  { id: 'streak_3', title: '3 jours foodie', emoji: '🔥', description: '3 jours consécutifs' },
  { id: 'streak_7', title: 'Semaine parfaite', emoji: '🏆', description: '7 jours de streak' },
  { id: 'streak_30', title: 'Addict officiel', emoji: '👑', description: '30 jours de streak' },
  { id: 'likes_10', title: 'Gourmet confirmé', emoji: '😋', description: '10 restaurants likés' },
  { id: 'likes_50', title: 'Grand Explorateur', emoji: '🗺️', description: '50 restaurants likés' },
  { id: 'level_5', title: 'Niveau 5 atteint', emoji: '⭐', description: 'Rang intermédiaire' },
  { id: 'level_10', title: 'Maître Foodie', emoji: '🌟', description: 'Rang maximum' },
  { id: 'cheap_hunter', title: 'Street Foodie', emoji: '🌮', description: '5 restos likés < 15€' },
  { id: 'gasto_hunter', title: 'Gastro Hunter', emoji: '🥂', description: '3 restos likés > 80€' },
  { id: 'swipes_100', title: 'Machine à swiper', emoji: '💪', description: '100 swipes au total' },
  { id: 'casino_win', title: 'Lucky Foodie', emoji: '🎰', description: 'Décroché un jackpot !' },
  { id: 'visit_1', title: 'Premier verdict', emoji: '📍', description: 'Première visite confirmée' },
  { id: 'visits_10', title: 'Critique en herbe', emoji: '📝', description: '10 visites confirmées' },
  { id: 'week_streak_4', title: 'Un mois de découvertes', emoji: '🔥', description: '4 semaines de série' },
  { id: 'quartiers_5', title: 'Cartographe', emoji: '🗺️', description: '5 quartiers explorés' },
  { id: 'photo_1', title: 'Éclaireur', emoji: '📸', description: 'Première vraie photo publiée' },
  { id: 'photos_5', title: 'Reporter', emoji: '🎞️', description: '5 vraies photos publiées' },
  { id: 'first_shot', title: 'Premier cliché', emoji: '🤳', description: 'Ta première photo de plat publiée' },
  { id: 'photographer', title: 'Photographe', emoji: '🖼️', description: '5 photos de plats publiées' },
  { id: 'friend_1', title: 'Premier ami', emoji: '🤝', description: 'Un ami ajouté' },
  { id: 'friends_5', title: 'La bande', emoji: '👯', description: '5 amis ajoutés' },
  { id: 'group_1', title: 'Chef de tablée', emoji: '🍽️', description: 'Une décision à plusieurs' },
  { id: 'defi_1', title: 'Défi relevé', emoji: '🎯', description: 'Un défi à l’aveugle relevé' },
];

export function computeLevel(totalXp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) return Math.min(i + 1, 10);
  }
  return 1;
}

/** XP totale stockée, tolérante aux valeurs corrompues. */
export function readTotalXp(): number {
  const total = readJson<{ total?: unknown }>(XP_KEY, {}).total;
  return typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

/** Barème des actions qui comptent vraiment (sortir manger, contribuer, inviter). */
export const XP = {
  visit: 40,
  photo: 30,
  friend: 25,
  group: 30,
  groupVote: 15,
  defiSent: 10,
  defiDone: 50,
} as const;

/**
 * LE chemin unique de l'XP. Écrit via lib/store (STORE_EVENT : toutes les instances se resynchronisent),
 * émet `xp`, puis exactement un `level` si au moins un seuil est franchi (niveau final + niveaux gagnés).
 * Retourne le nouveau niveau s'il a changé, sinon null. Montant invalide ou écriture impossible : rien.
 */
export function awardXp(amount: number, reason: XpReason = 'other'): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  const gain = Math.round(amount);
  if (gain <= 0) return null;
  const raw = readJson<unknown>(XP_KEY, {});
  const stored = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const before = readTotalXp();
  const after = before + gain;
  if (!writeJson(XP_KEY, { ...stored, total: after })) return null;

  emitCelebration({ type: 'xp', amount: gain, total: after, reason });

  const lvBefore = computeLevel(before);
  const lvAfter = computeLevel(after);
  if (lvAfter <= lvBefore) return null;
  emitCelebration({ type: 'level', level: lvAfter, from: lvBefore, gained: lvAfter - lvBefore, total: after });
  pushNotification({ id: `level-${lvAfter}`, kind: 'achievement', title: `Niveau ${lvAfter} !`, body: 'De nouvelles mascottes et avantages se débloquent.', ref: 'level_5' });
  if (lvAfter >= 5) unlockAchievement('level_5');
  if (lvAfter >= 10) unlockAchievement('level_10');
  return lvAfter;
}

/** Débloque un succès (une seule fois), prévient via la cloche et émet `achievement`. Retourne true s'il est nouveau. */
export function unlockAchievement(id: string): boolean {
  const stored = readJson<unknown>(ACH_KEY, []);
  const ids = Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [];
  if (ids.includes(id)) return false;
  const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return false;
  if (!writeJson(ACH_KEY, [...ids, id])) return false;
  pushNotification({ id: `ach-${id}`, kind: 'achievement', title: ach.title, body: ach.description, ref: id });
  emitCelebration({ type: 'achievement', id, title: ach.title, description: ach.description });
  return true;
}

export interface PhotoAward {
  xp: number;
  reason: PhotoRewardReason;
  /** Toast à afficher (null si aucune récompense). */
  message: string | null;
}

/**
 * Récompense la publication d'un post (à appeler UNE fois par publication, après l'enregistrement local réussi).
 * `knownPhotos` = photos communautaires connues du resto AVANT ce post (voir countKnownPhotos).
 */
export function awardPhotoPost(input: { restId: string; hasPhoto: boolean; knownPhotos: number; now?: number }): PhotoAward {
  const state = normalizePhotoXp(readJson<unknown>(PHOTO_XP_KEY, null));
  const result = computePhotoReward(state, { ...input, now: input.now ?? Date.now() });
  if (result.reason === 'no_photo') return { xp: 0, reason: result.reason, message: null };
  writeJson(PHOTO_XP_KEY, result.state);
  if (result.xp > 0) awardXp(result.xp, 'photo');
  if (result.state.posted >= 1) unlockAchievement('first_shot');
  if (result.state.posted >= PHOTOGRAPHER_TARGET) unlockAchievement('photographer');
  return { xp: result.xp, reason: result.reason, message: photoRewardMessage(result.xp) };
}

const CLOUD_COUNT_TIMEOUT_MS = 2000;

/** Photos connues d'un resto : celles de ce téléphone plus celles du serveur (réponse limitée à 2 s, sinon le serveur compte pour 0). */
export async function countKnownPhotos(restId: string, localCount: number): Promise<number> {
  // Import à la demande : le moteur de récompenses ne charge pas le client cloud (ni de dépendance circulaire).
  const remote = import('./cloud/social')
    .then(m => m.fetchRestaurantPhotos([restId]))
    .then(m => m.get(restId)?.length ?? 0)
    .catch(() => 0);
  const timeout = new Promise<number>(resolve => setTimeout(() => resolve(0), CLOUD_COUNT_TIMEOUT_MS));
  return Math.max(localCount, await Promise.race([remote, timeout]));
}

export const maxLevelXp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
