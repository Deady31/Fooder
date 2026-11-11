import { ACH_KEY, ALL_ACHIEVEMENTS, LEVEL_THRESHOLDS, XP_KEY, computeLevel } from '../hooks/useGamification';
import { pushNotification } from './notifications';
import { readJson, writeJson } from './store';

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

export const maxLevelXp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
