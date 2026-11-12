import type { Restaurant } from '../../data/mockRestaurants';
import type { SwipeDir } from './SwipeDeck';
import type { Checkin } from '../../lib/visits';

/** Dernier swipe, mémorisé pour pouvoir être annulé (un seul niveau). */
export interface LastSwipe {
  rest: Restaurant;
  dir: SwipeDir;
  /** déjà présent dans la liste du choix (likes ou dislikes) avant ce swipe : l'annulation ne doit pas le retirer */
  wasInChoiceList: boolean;
  /** déjà dans la wishlist avant ce like */
  wasInWishlist: boolean;
  /** un rendez-vous « Tu y es allé ? » existait déjà avant ce like : l'annulation ne doit pas le retirer */
  hadCheckin: boolean;
}

/** Copie de la liste sans l'élément d'id donné. */
export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter(item => item.id !== id);
}

/** Copie de la liste sans le rendez-vous « Tu y es allé ? » encore en attente de ce resto. */
export function removePendingCheckin(list: readonly Checkin[], restId: string): Checkin[] {
  return list.filter(c => !(c.restId === restId && c.status === 'pending'));
}
