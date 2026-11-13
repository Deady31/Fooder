/**
 * État du deck (pur, testé) et mémoire de session.
 * La pile est stockée inversée : la carte du dessus est à `index`, les cartes à venir en dessous
 * (index - 1 est la suivante), les cartes déjà swipées au-dessus (gardées pour l'annulation).
 */
import type { Restaurant } from '../data/mockRestaurants';
import type { Coords } from './geo/position';
import { orderDeck } from './deckLoader';

export interface Deck {
  list: Restaurant[];
  index: number;
}

export const EMPTY_DECK: Deck = { list: [], index: -1 };

/** Cartes encore à voir, la carte du dessus en dernier. */
export function remaining(deck: Deck): Restaurant[] {
  return deck.list.slice(0, deck.index + 1);
}

/**
 * Réordonne les cartes à venir par distance depuis `origin` (et y fusionne `extra`, sans doublon).
 * Les cartes épinglées (celles déjà visibles à l'écran) gardent leur place au sommet : la carte
 * du dessus ne change jamais à cause d'un changement de position.
 */
export function reorderUpcoming(deck: Deck, origin: Coords, pinned: ReadonlySet<string>, extra: readonly Restaurant[] = []): Deck {
  const rest = remaining(deck);
  const done = deck.list.slice(deck.index + 1);
  const known = new Set(deck.list.map(r => r.id));
  const fresh = extra.filter(r => !known.has(r.id) && (known.add(r.id), true));
  const kept = rest.filter(r => pinned.has(r.id));
  const upcoming = orderDeck([...rest.filter(r => !pinned.has(r.id)), ...fresh], origin);
  const nextRemaining = [...[...upcoming].reverse(), ...kept];
  return { list: [...nextRemaining, ...done], index: nextRemaining.length - 1 };
}

/** Ajoute des cartes tout en bas de la pile (après toutes les autres). */
export function appendBottom(deck: Deck, fresh: readonly Restaurant[]): Deck {
  if (fresh.length === 0) return deck;
  return { list: [...[...fresh].reverse(), ...deck.list], index: deck.index + fresh.length };
}

/** Nouvel index après le swipe de `restId` (le deck affiché peut être filtré). */
export function swipeIndex(deck: Deck, restId: string, deckIndex: number): number {
  const found = deck.list.findIndex(r => r.id === restId);
  return (found >= 0 ? found : deckIndex) - 1;
}

/** Index qui remet `restId` au sommet, ou null s'il n'est plus dans la pile. */
export function undoIndex(deck: Deck, restId: string): number | null {
  const found = deck.list.findIndex(r => r.id === restId);
  return found >= 0 ? found : null;
}

/* ── Mémoire de session (retour sur l'onglet sans recharger) ───────── */

export interface DeckSnapshot {
  deck: Deck;
  all: Restaurant[];
  origin: Coords;
  moodId: string;
  page: { offset: number; total: number };
}

export const DECK_TTL_MS = 10 * 60_000;

let snapshot: (DeckSnapshot & { savedAt: number }) | null = null;

export function saveDeckSnapshot(s: DeckSnapshot, now: number = Date.now()): void {
  snapshot = { ...s, savedAt: now };
}

/** La pile mémorisée si elle a moins de 10 min et la même humeur, sinon null. */
export function loadDeckSnapshot(moodId: string, now: number = Date.now()): DeckSnapshot | null {
  if (!snapshot || snapshot.moodId !== moodId || now - snapshot.savedAt > DECK_TTL_MS) return null;
  const { savedAt: _savedAt, ...rest } = snapshot;
  return rest;
}

export function clearDeckSnapshot(): void {
  snapshot = null;
}
