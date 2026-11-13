'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Restaurant } from '../../data/mockRestaurants';
import { track } from '../../lib/analytics';
import type { Deck } from '../../lib/deckStore';
import { swipeIndex, undoIndex } from '../../lib/deckStore';
import { DISLIKES_KEY, readDislikes, readLikes, removeDislike, toggleLike } from '../../lib/likes';
import { writeJson } from '../../lib/store';
import { swipeProps } from '../../lib/usageProps';
import { CHECKINS_KEY, queueCheckin, readCheckins } from '../../lib/visits';
import { createRewardLedger } from './rewardLedger';
import type { SwipeDir } from './SwipeDeck';
import { LastSwipe, removePendingCheckin } from './undo';

const EXIT_ANIM_MS = 550;

interface Rewards {
  gainXP: (n: number) => void;
  unlock: (id: string) => void;
  missionProgress: (id: string) => void;
}

/** Enregistre le like (likes + favoris via lib/likes : le badge Favoris se met à jour en direct). */
function persistLike(rest: Restaurant): void {
  if (!readLikes().some(r => r.id === rest.id)) toggleLike(rest);
}

function persistDislike(rest: Restaurant): void {
  const list = readDislikes();
  if (!list.some(r => r.id === rest.id)) writeJson(DISLIKES_KEY, [...list, rest]);
}

function unlockLikeMilestones(unlock: Rewards['unlock']): void {
  const likes = readLikes();
  if (likes.length >= 10) unlock('likes_10');
  if (likes.length >= 50) unlock('likes_50');
  if (likes.filter(r => r.price < 15).length >= 5) unlock('cheap_hunter');
  if (likes.filter(r => r.price > 80).length >= 3) unlock('gasto_hunter');
}

/**
 * Swipe, récompenses (une seule fois par resto : anti-farm d'XP), check-in différé et annulation d'un niveau.
 */
export function useSwipeActions(deck: Deck, setDeck: (u: (d: Deck) => Deck) => void, rewards: Rewards, onLowDeck: () => void) {
  const [lastSwipe, setLastSwipe] = useState<LastSwipe | null>(null);
  const [exiting, setExiting] = useState(false);
  const [burst, setBurst] = useState({ id: 0, active: false });
  const [casinoRest, setCasinoRest] = useState<string | null>(null);
  const ledger = useRef(createRewardLedger());
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  const swiped = (direction: SwipeDir, restaurant: Restaurant, deckIndex: number) => {
    const { gainXP, unlock, missionProgress } = rewards;
    const firstSwipe = ledger.current.claim(`${restaurant.id}:swipe`);
    const before = direction === 'right' ? readLikes() : readDislikes();
    setLastSwipe({
      rest: restaurant,
      dir: direction,
      wasInChoiceList: before.some(r => r.id === restaurant.id),
      wasInWishlist: before.some(r => r.id === restaurant.id),
      hadCheckin: readCheckins().some(c => c.restId === restaurant.id),
    });
    setExiting(true);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setExiting(false), EXIT_ANIM_MS);

    track('swipe', { direction });
    if (firstSwipe) track(direction === 'right' ? 'swipe_like' : 'swipe_pass', swipeProps(restaurant));
    const nextIndex = swipeIndex(deck, restaurant.id, deckIndex);
    setDeck(d => ({ ...d, index: swipeIndex(d, restaurant.id, deckIndex) }));
    if (nextIndex < 6) onLowDeck();

    if (firstSwipe) {
      gainXP(5);
      unlock('first_swipe');
      missionProgress('swipe_5');
      missionProgress('swipe_10');
      missionProgress('swipe_20');
    }

    if (direction === 'right') {
      const firstLike = ledger.current.claim(`${restaurant.id}:like`);
      persistLike(restaurant);
      if (firstLike) queueCheckin(restaurant);
      if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(50);
      setBurst(b => ({ id: b.id + 1, active: true }));
      if (firstLike) {
        gainXP(15);
        unlock('first_like');
        missionProgress('like_3');
        if (restaurant.price < 15) missionProgress('like_cheap');
        if (restaurant.price > 50) missionProgress('like_gastro');
      }
      unlockLikeMilestones(unlock);
      if (firstLike && Math.random() < 0.1) {
        setCasinoRest(restaurant.name);
        unlock('casino_win');
      }
    } else {
      persistDislike(restaurant);
      if (ledger.current.claim(`${restaurant.id}:dislike`)) missionProgress('dislike_5');
    }
    if (readLikes().length + readDislikes().length >= 100) unlock('swipes_100');
  };

  /** Remet la dernière carte au sommet et retire son effet. XP et missions ne sont pas rejouées au re-swipe. */
  const undoLast = () => {
    const last = lastSwipe;
    if (!last || exiting) return;
    setLastSwipe(null);
    const index = undoIndex(deck, last.rest.id);
    if (index === null) return;
    const id = last.rest.id;
    if (last.dir === 'right') {
      if (!last.wasInChoiceList && readLikes().some(r => r.id === id)) toggleLike(last.rest);
      if (!last.hadCheckin) writeJson(CHECKINS_KEY, removePendingCheckin(readCheckins(), id));
    } else if (!last.wasInChoiceList) {
      removeDislike(id);
    }
    setCasinoRest(null);
    setDeck(d => ({ ...d, index }));
  };

  const endBurst = useCallback(() => setBurst(b => ({ ...b, active: false })), []);
  const endCasino = useCallback(() => setCasinoRest(null), []);
  const resetUndo = useCallback(() => setLastSwipe(null), []);

  return { swiped, undoLast, lastSwipe, exiting, burst, endBurst, casinoRest, endCasino, resetUndo };
}
