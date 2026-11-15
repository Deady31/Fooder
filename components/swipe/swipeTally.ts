import type { Restaurant } from '../../data/mockRestaurants';
import type { SwipeDir } from './SwipeDeck';

/** Bilan des swipes de la session en cours (page Découvrir) : sert au récap de fin de paquet. */
export interface SwipeTally {
  /** Coups de cœur du paquet, du plus ancien au plus récent (un resto une seule fois). */
  liked: Restaurant[];
  passed: number;
}

export const EMPTY_TALLY: SwipeTally = { liked: [], passed: 0 };

export function addSwipe(tally: SwipeTally, dir: SwipeDir, rest: Restaurant): SwipeTally {
  if (dir === 'right') {
    if (tally.liked.some(r => r.id === rest.id)) return tally;
    return { ...tally, liked: [...tally.liked, rest] };
  }
  return { ...tally, passed: tally.passed + 1 };
}

/** Annule le dernier swipe (même sens, même resto). Sans effet si le resto n'est pas dans le bilan. */
export function undoSwipe(tally: SwipeTally, dir: SwipeDir, restId: string): SwipeTally {
  if (dir === 'right') {
    if (!tally.liked.some(r => r.id === restId)) return tally;
    return { ...tally, liked: tally.liked.filter(r => r.id !== restId) };
  }
  return tally.passed > 0 ? { ...tally, passed: tally.passed - 1 } : tally;
}

export const tallyTotal = (t: SwipeTally): number => t.liked.length + t.passed;
