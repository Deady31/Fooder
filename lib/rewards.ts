import { ACH_KEY, ALL_ACHIEVEMENTS, LEVEL_THRESHOLDS, XP_KEY, computeLevel } from '../hooks/useGamification';
import { pushNotification } from './notifications';
import { readJson, writeJson } from './store';
import { fetchRestaurantPhotos } from './cloud/social';
import {
  PHOTOGRAPHER_TARGET, PHOTO_XP_KEY, PhotoRewardReason, computePhotoReward, normalizePhotoXp, photoRewardMessage,
} from './photoXp';

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

/** Ajoute de l'XP hors du hook (pages Amis, Groupe…). Retourne le nouveau niveau s'il a changé. */
export function awardXp(amount: number): number | null {
  const stored = readJson<{ total?: number }>(XP_KEY, {});
  const before = stored.total ?? 0;
  const after = before + amount;
  writeJson(XP_KEY, { ...stored, total: after });
  const lvBefore = computeLevel(before);
  const lvAfter = computeLevel(after);
  if (lvAfter > lvBefore) {
    pushNotification({ id: `level-${lvAfter}`, kind: 'achievement', title: `Niveau ${lvAfter} !`, body: 'De nouvelles mascottes et avantages se débloquent.', ref: 'level_5' });
    if (lvAfter >= 5) unlockAchievement('level_5');
    if (lvAfter >= 10) unlockAchievement('level_10');
    return lvAfter;
  }
  return null;
}

/** Débloque un succès (une seule fois) et prévient via la cloche. Retourne true s'il est nouveau. */
export function unlockAchievement(id: string): boolean {
  const ids = readJson<string[]>(ACH_KEY, []);
  if (ids.includes(id)) return false;
  const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return false;
  writeJson(ACH_KEY, [...ids, id]);
  pushNotification({ id: `ach-${id}`, kind: 'achievement', title: ach.title, body: ach.description, ref: id });
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
  if (result.xp > 0) awardXp(result.xp);
  if (result.state.posted >= 1) unlockAchievement('first_shot');
  if (result.state.posted >= PHOTOGRAPHER_TARGET) unlockAchievement('photographer');
  return { xp: result.xp, reason: result.reason, message: photoRewardMessage(result.xp) };
}

const CLOUD_COUNT_TIMEOUT_MS = 2000;

/** Photos connues d'un resto : celles de ce téléphone plus celles du serveur (réponse limitée à 2 s, sinon le serveur compte pour 0). */
export async function countKnownPhotos(restId: string, localCount: number): Promise<number> {
  const remote = fetchRestaurantPhotos([restId]).then(m => m.get(restId)?.length ?? 0).catch(() => 0);
  const timeout = new Promise<number>(resolve => setTimeout(() => resolve(0), CLOUD_COUNT_TIMEOUT_MS));
  return Math.max(localCount, await Promise.race([remote, timeout]));
}

export const maxLevelXp =LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
