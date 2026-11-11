/**
 * Série hebdomadaire : nombre de semaines consécutives avec au moins une visite.
 * La semaine en cours ne casse jamais la série (on a jusqu'à dimanche soir).
 * Un joker absorbe une semaine manquée (vacances, semaine chargée).
 */

const DAY = 86_400_000;

/** Index de semaine (lundi → dimanche, heure locale). */
export function weekIndex(ts: number): number {
  const d = new Date(ts);
  const dayNum = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
  return Math.floor((dayNum + 3) / 7); // le 1er janvier 1970 était un jeudi
}

export interface WeeklyStreak {
  current: number;
  thisWeekDone: boolean;
  jokerUsed: boolean;
  jokersLeft: number;
}

export const JOKERS = 1;

export function weeklyStreak(visitTimes: number[], now: number = Date.now(), jokers: number = JOKERS): WeeklyStreak {
  const weeks = new Set(visitTimes.map(weekIndex));
  const cur = weekIndex(now);
  const thisWeekDone = weeks.has(cur);
  let w = thisWeekDone ? cur : cur - 1;
  let current = 0;
  let left = jokers;
  while (w >= 0) {
    if (weeks.has(w)) {
      current++;
      w--;
    } else if (current > 0 && left > 0 && weeks.has(w - 1)) {
      left--;
      w--;
    } else {
      break;
    }
  }
  return { current, thisWeekDone, jokerUsed: left < jokers, jokersLeft: left };
}

/** Clé lisible de la semaine, utilisée pour dédoublonner les notifications hebdomadaires. */
export const weekKey = (ts: number = Date.now()): string => `w${weekIndex(ts)}`;

export function visitsThisWeek(visitTimes: number[], now: number = Date.now()): number {
  const cur = weekIndex(now);
  return visitTimes.filter(t => weekIndex(t) === cur).length;
}
