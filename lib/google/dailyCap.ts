/**
 * Plafond journalier d'appels payants (média photo), jour en heure de Paris.
 * Compteur en mémoire de l'instance : avec plusieurs instances serverless le plafond reste approximatif.
 * Le vrai plafond sûr est le quota journalier réglé dans la console Google Cloud.
 */

export const DEFAULT_DAILY_CAP = 30;

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Jour calendaire (AAAA-MM-JJ) en heure de Paris. */
export function parisDay(date: Date): string {
  return PARIS_DAY.format(date);
}

/** Lit GOOGLE_PHOTOS_DAILY_CAP : entier >= 0, sinon défaut (30). */
export function parseDailyCap(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DAILY_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_CAP;
}

export interface DailyCounter {
  tryConsume(now: Date): boolean;
  isExhausted(now: Date): boolean;
  used(now: Date): number;
}

export function createDailyCounter(cap: number): DailyCounter {
  let day = '';
  let count = 0;
  const roll = (now: Date): void => {
    const d = parisDay(now);
    if (d !== day) {
      day = d;
      count = 0;
    }
  };
  return {
    tryConsume(now) {
      roll(now);
      if (count >= cap) return false;
      count += 1;
      return true;
    },
    isExhausted(now) {
      roll(now);
      return count >= cap;
    },
    used(now) {
      roll(now);
      return count;
    },
  };
}
