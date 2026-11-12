/** Maintien nécessaire pour ouvrir la fiche (ms) */
export const HOLD_MS = 500;
/** Déplacement (px) au-delà duquel l'appui devient un glissement */
export const MOVE_TOLERANCE = 14;

export interface ReleaseState {
  /** distance parcourue entre l'appui et le relâchement (px) */
  distance: number;
  /** l'appui est toujours actif (ni annulé par un glissement, ni déjà consommé par le maintien) */
  pressActive: boolean;
  /** le geste a validé un swipe */
  committedSwipe: boolean;
  holdToOpen: boolean;
}

/** Un simple appui relâché sans glissement ouvre la fiche ; un swipe ne l'ouvre jamais. */
export function shouldOpenOnRelease({ distance, pressActive, committedSwipe, holdToOpen }: ReleaseState): boolean {
  return holdToOpen && pressActive && !committedSwipe && distance < MOVE_TOLERANCE;
}
