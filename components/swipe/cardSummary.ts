import type { Restaurant } from '../../data/mockRestaurants';
import { closesAt, formatCloseTime, isOpenAt } from '../../lib/openingHours';

const WALK_M_PER_MIN = 80;

/** Minutes de marche (~80 m/min), au minimum 1 ; null si la distance est inconnue. */
export function walkMinutes(meters: number | undefined): number | null {
  if (meters === undefined || !Number.isFinite(meters) || meters < 0) return null;
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

/** Une ligne « Ouvert jusqu'à 22 h · 3 min à pied · carte en ligne » : seulement les informations connues. */
export function cardSummary(rest: Restaurant, now: Date = new Date()): string {
  const parts: string[] = [];

  const open = isOpenAt(rest.hours, now);
  if (open === true) {
    const close = closesAt(rest.hours, now);
    parts.push(close ? `Ouvert jusqu’à ${formatCloseTime(close)}` : 'Ouvert');
  } else if (open === false) {
    parts.push('Fermé');
  }

  const walk = walkMinutes(rest.distanceMeters);
  if (walk !== null) parts.push(`${walk} min à pied`);

  if (rest.website) parts.push('carte en ligne');

  return parts.join(' · ');
}
