'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mockRestaurants, type Restaurant } from '../../data/mockRestaurants';
import { fetchRestaurantPhotoDetails } from '../../lib/cloud/social';
import {
  fetchApiPage,
  initialDeck,
  matchesMood,
  moodPool,
  orderDeck,
  seenIdsFrom,
  withCloudCommunity,
  withDistances,
  withLocalCommunity,
} from '../../lib/deckLoader';
import { EMPTY_DECK, appendBottom, loadDeckSnapshot, reorderUpcoming, saveDeckSnapshot, type Deck } from '../../lib/deckStore';
import { haversine } from '../../lib/geo';
import type { Coords, PositionState } from '../../lib/geo/position';
import { DISLIKES_KEY, LIKES_KEY } from '../../lib/likes';
import { readJson } from '../../lib/store';
import type { CommunityPhoto } from '../../lib/photoPriority';

/** Au-delà de ce déplacement, la page API est redemandée depuis la nouvelle origine. */
const REFETCH_MOVE_M = 300;
/** En dessous, les distances affichées ne changent pas assez pour réordonner. */
const REORDER_MOVE_M = 25;

const dist = (a: Coords, b: Coords) => haversine(a.lat, a.lng, b.lat, b.lng);
const seenIds = () => seenIdsFrom([readJson<unknown>(LIKES_KEY, []), readJson<unknown>(DISLIKES_KEY, [])]);

export interface DiscoverDeck {
  deck: Deck;
  setDeck: (update: (d: Deck) => Deck) => void;
  isLoading: boolean;
  /** Cartes visibles à ne pas déplacer (la carte du dessus et les deux suivantes). */
  pinned: ReadonlySet<string>;
  unpin: () => void;
  loadMore: () => Promise<void>;
  selectMood: (moodId: string) => void;
}

/**
 * Pile de Découvrir : affichée tout de suite (fiches locales, dernière position ou Capitole),
 * complétée par l'API en arrière-plan, réordonnée quand la position précise arrive sans toucher
 * aux cartes visibles, mémorisée en session (retour sur l'onglet sans rechargement).
 */
export function useDiscoverDeck(position: PositionState, moodId: string, ready: boolean, visibleIds: () => string[]): DiscoverDeck {
  const [deck, setDeckState] = useState<Deck>(EMPTY_DECK);
  const [isLoading, setIsLoading] = useState(true);
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const all = useRef<Restaurant[]>([]);
  const page = useRef({ offset: 0, total: Infinity, loading: false, origin: position.coords });
  const deckOrigin = useRef<Coords>(position.coords);
  const deckFromDefault = useRef(position.source === 'default');
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const posRef = useRef(position);
  posRef.current = position;
  const visibleRef = useRef(visibleIds);
  visibleRef.current = visibleIds;
  const started = useRef(false);

  const setDeck = useCallback((update: (d: Deck) => Deck) => setDeckState(prev => update(prev)), []);
  const pinVisible = () => {
    const ids = new Set(visibleRef.current());
    setPinned(ids);
    return ids;
  };

  /** Photos de la communauté en ligne, après l'affichage, sans toucher aux cartes visibles. */
  const enrichCloud = (ids: string[]) => {
    fetchRestaurantPhotoDetails(ids)
      .catch(() => new Map<string, CommunityPhoto[]>())
      .then(cloud => {
        if (cloud.size === 0) return;
        const skip = new Set(visibleRef.current());
        all.current = withCloudCommunity(all.current, cloud, skip);
        setDeckState(d => ({ ...d, list: withCloudCommunity(d.list, cloud, skip) }));
      });
  };

  /** Page API depuis l'origine courante, fusionnée sous les cartes visibles. */
  const fetchFirstPage = async (origin: Coords) => {
    page.current = { offset: 0, total: Infinity, loading: true, origin };
    const res = await fetchApiPage(origin, 0);
    page.current.loading = false;
    if (!res) {
      setIsLoading(false);
      return;
    }
    page.current.offset = res.items.length;
    page.current.total = res.total;
    const pos = posRef.current;
    const seen = seenIds();
    const have = new Set(all.current.map(r => r.id));
    const fresh = withLocalCommunity(withDistances(res.items.filter(r => !have.has(r.id) && !seen.has(r.id)), pos.coords, pos.source));
    if (deckRef.current.list.length === 0) {
      const d = initialDeck({ mock: mockRestaurants, api: res.items, seen, moodId, origin: pos.coords, source: pos.source });
      d.list = withLocalCommunity(d.list);
      all.current = [...d.list].reverse();
      setDeckState(d);
    } else {
      all.current = [...all.current, ...fresh];
      const pins = pinVisible();
      setDeckState(d => reorderUpcoming(d, pos.coords, pins, fresh.filter(r => matchesMood(r, moodId))));
    }
    setIsLoading(false);
    enrichCloud(all.current.map(r => r.id));
  };

  // Démarrage : mémoire de session, sinon pile immédiate puis API en arrière-plan (jamais d'attente GPS).
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const snap = loadDeckSnapshot(moodId);
    if (snap) {
      all.current = snap.all;
      page.current = { ...snap.page, loading: false, origin: snap.origin };
      deckOrigin.current = snap.origin;
      setDeckState(snap.deck);
      setIsLoading(false);
      return;
    }
    const pos = posRef.current;
    deckOrigin.current = pos.coords;
    deckFromDefault.current = pos.source === 'default';
    const d = initialDeck({ mock: mockRestaurants, api: [], seen: seenIds(), moodId, origin: pos.coords, source: pos.source, fallbackToSeen: false });
    d.list = withLocalCommunity(d.list);
    all.current = [...d.list].reverse();
    setDeckState(d);
    if (d.list.length > 0) setIsLoading(false);
    void fetchFirstPage(pos.coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Nouvelle position : distances recalculées, cartes à venir réordonnées, page API redemandée si on a bougé.
  useEffect(() => {
    if (!started.current || isLoading) return;
    const origin = position.coords;
    const moved = dist(deckOrigin.current, origin);
    const sourceChanged = deckFromDefault.current !== (position.source === 'default');
    if (moved < REORDER_MOVE_M && !sourceChanged) return;
    deckOrigin.current = origin;
    deckFromDefault.current = position.source === 'default';
    all.current = withDistances(all.current, origin, position.source);
    const pins = pinVisible();
    setDeckState(d => reorderUpcoming({ ...d, list: withDistances(d.list, origin, position.source) }, origin, pins));
    if (dist(page.current.origin, origin) >= REFETCH_MOVE_M) void fetchFirstPage(origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.coords.lat, position.coords.lng, position.source, isLoading]);

  // Mémoire de session à chaque changement.
  useEffect(() => {
    if (!started.current || isLoading) return;
    saveDeckSnapshot({ deck, all: all.current, origin: deckOrigin.current, moodId, page: { offset: page.current.offset, total: page.current.total } });
  }, [deck, isLoading, moodId]);

  /** Ajoute une page de restos au bas du deck quand il reste peu de cartes. */
  const loadMore = useCallback(async () => {
    const pg = page.current;
    if (pg.loading || pg.offset >= pg.total) return;
    pg.loading = true;
    try {
      const res = await fetchApiPage(pg.origin, pg.offset);
      if (!res) return;
      pg.offset += res.items.length;
      pg.total = res.total;
      const pos = posRef.current;
      const have = new Set(all.current.map(r => r.id));
      const seen = seenIds();
      const fresh = withLocalCommunity(withDistances(res.items.filter(r => !have.has(r.id) && !seen.has(r.id)), pos.coords, pos.source));
      if (fresh.length === 0) return;
      all.current = [...all.current, ...fresh];
      const add = orderDeck(fresh.filter(r => matchesMood(r, moodId)), pos.coords);
      if (add.length > 0) setDeckState(d => appendBottom(d, add));
    } finally {
      pg.loading = false;
    }
  }, [moodId]);

  const selectMood = useCallback((nextMood: string) => {
    const pos = posRef.current;
    const pool = moodPool(orderDeck(all.current, pos.coords), nextMood);
    setPinned(new Set());
    setDeckState({ list: [...pool].reverse(), index: pool.length - 1 });
  }, []);

  const unpin = useCallback(() => setPinned(new Set()), []);

  return { deck, setDeck, isLoading, pinned, unpin, loadMore, selectMood };
}
