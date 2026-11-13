/** Décompte de la série hebdomadaire (lib/streak) : jamais de donnée inventée, seulement la semaine en cours. */
const URGENT_DAYS = 2;

/** Jours restants dans la semaine lundi → dimanche, aujourd'hui compris (lundi 7, dimanche 1). */
export function daysLeftInWeek(now: number = Date.now()): number {
  return ((7 - new Date(now).getDay()) % 7) + 1;
}

export interface StreakHint { text: string; days: number; urgent: boolean }

export function streakHint(streak: { current: number; thisWeekDone: boolean }, now: number = Date.now()): StreakHint | null {
  if (streak.current <= 0 || streak.thisWeekDone) return null;
  const days = daysLeftInWeek(now);
  return { text: `Plus que ${days} jour${days > 1 ? 's' : ''} pour garder ta série`, days, urgent: days <= URGENT_DAYS };
}
