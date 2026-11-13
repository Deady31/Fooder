'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Restaurant } from '../../../data/mockRestaurants';
import { track } from '../../../lib/analytics';
import { useGamification } from '../../../hooks/useGamification';
import { useMissions } from '../../../hooks/useMissions';
import { MoodSheet } from '../../../components/MoodSheet';
import { CasinoOverlay } from '../../../components/CasinoOverlay';
import { AchievementToast } from '../../../components/AchievementToast';
import { SwipeDeck, SwipeDeckHandle } from '../../../components/swipe/SwipeDeck';
import { ActionButtons } from '../../../components/swipe/ActionButtons';
import { StickerBurst } from '../../../components/swipe/StickerBurst';
import { DetailSheet } from '../../../components/swipe/DetailSheet';
import { FilterSheet, type FilterValues } from '../../../components/swipe/FilterSheet';
import { DiscoverHeader, FilterChips } from '../../../components/swipe/DiscoverHeader';
import { DeckDesert, DeckEnd, DeckLoader, DeckNoMatch } from '../../../components/swipe/DeckStates';
import { useDeckFilters } from '../../../components/swipe/useDeckFilters';
import { useDiscoverDeck } from '../../../components/swipe/useDiscoverDeck';
import { useSwipeActions } from '../../../components/swipe/useSwipeActions';
import { PositionSheet } from '../../../components/geo/PositionSheet';
import { RadiusSheet } from '../../../components/geo/RadiusSheet';
import { openCardProps } from '../../../lib/usageProps';
import { applyFilters, blockingFilter, type FilterOptions } from '../../../lib/filters';
import { remaining } from '../../../lib/deckStore';
import { usePosition } from '../../../lib/geo/usePosition';
import { useUserAddress } from '../../../lib/geo/useAddress';
import { nextRadiusWithResults, type Radius } from '../../../lib/geo/radius';
import { readJson, writeJson } from '../../../lib/store';

const PREFS_KEY = 'fooder_preferences';
const HINT_KEY = 'fooder_swipe_hint_seen';
const MAX_AUTO_LOADS = 3;
const VISIBLE_DEPTH = 3;

type Sheets = 'filters' | 'mood' | 'position' | 'radius' | null;

export default function SwipePage() {
  const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
  const [sheet, setSheet] = useState<Sheets>(null);
  const [moodLabel, setMoodLabel] = useState('Surprends-moi');
  const [moodId, setMoodId] = useState('surprise');
  const [prefsReady, setPrefsReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const closeSheet = useCallback(() => setSheet(null), []);

  const { newAchievement, clearNewAchievement, gainXP, unlock } = useGamification();
  const { progress: missionProgress } = useMissions();
  const filters = useDeckFilters();
  const { position, locate, setManual } = usePosition();
  const { address, status: addressStatus } = useUserAddress(position);

  useEffect(() => {
    const prefs = readJson<Record<string, unknown>>(PREFS_KEY, {});
    if (typeof prefs.cravingLabel === 'string') setMoodLabel(prefs.cravingLabel);
    if (typeof prefs.craving === 'string') setMoodId(prefs.craving);
    setShowHint(readJson<boolean>(HINT_KEY, false) !== true);
    setPrefsReady(true);
  }, []);

  const deckRef = useRef<SwipeDeckHandle>(null);
  const visible = useRef<string[]>([]);
  const getVisible = useCallback(() => visible.current, []);
  const { deck, setDeck, isLoading, pinned, unpin, loadMore, selectMood } = useDiscoverDeck(position, moodId, filters.ready && prefsReady, getVisible);
  const actions = useSwipeActions(deck, setDeck, { gainXP, unlock, missionProgress }, () => void loadMore());

  // Un changement de filtre voulu par l'utilisateur libère les cartes épinglées (la pile suit les filtres).
  useEffect(() => { unpin(); }, [filters.version, unpin]);

  const rem = useMemo(() => remaining(deck), [deck]);
  const opts: FilterOptions = {
    openNow: filters.openNow, diets: filters.diets, now: filters.now, origin: position.coords,
    radiusM: filters.radius, maxPrice: filters.maxPrice, cuisine: filters.cuisine,
  };
  const passing = new Set(applyFilters(rem, opts).map(r => r.id));
  const deckCards = rem.filter(r => passing.has(r.id) || pinned.has(r.id));
  visible.current = deckCards.slice(-VISIBLE_DEPTH).map(r => r.id);
  const widenTo = nextRadiusWithResults(filters.radius, r => applyFilters(rem, { ...opts, radiusM: r }).length);
  const cuisines = Array.from(new Set(rem.map(r => r.cuisine))).sort((a, b) => a.localeCompare(b, 'fr'));

  // Peu de cartes dans le rayon : quelques pages de plus (plafonné).
  const autoLoads = useRef(0);
  // Remis à zéro par un filtre ou un swipe, pas par l'ajout d'une page (qui décale l'index).
  const swipedCount = deck.list.length - 1 - deck.index;
  useEffect(() => { autoLoads.current = 0; }, [filters.version, swipedCount]);
  useEffect(() => {
    if (isLoading || deckCards.length >= 6 || autoLoads.current >= MAX_AUTO_LOADS) return;
    autoLoads.current += 1;
    void loadMore();
  }, [isLoading, deckCards.length, deck.list.length, loadMore]);

  const isDeckEmpty = deck.index < 0 && deck.list.length > 0;
  const noMatch = !isDeckEmpty && deck.list.length > 0 && deckCards.length === 0;

  const onSwipe: typeof actions.swiped = (dir, rest, i) => {
    if (showHint) {
      setShowHint(false);
      writeJson(HINT_KEY, true);
    }
    actions.swiped(dir, rest, i);
  };

  const openDetails = (restaurant: Restaurant) => {
    setSelectedRest(restaurant);
    track('open_card', openCardProps(restaurant, 'swipe'));
    missionProgress('open_detail');
  };

  const handleMoodSelect = (id: string, label: string) => {
    setMoodId(id);
    setMoodLabel(label);
    writeJson(PREFS_KEY, { ...readJson<Record<string, unknown>>(PREFS_KEY, {}), craving: id, cravingLabel: label });
    selectMood(id);
    actions.resetUndo();
  };

  const widen = (r: Radius) => filters.setRadius(r);
  const applySheet = (v: FilterValues) => {
    if (v.radius !== filters.radius) filters.setRadius(v.radius);
    filters.setBudgetAndCuisine(v.maxPrice, v.cuisine);
  };
  const fixBlock = () => {
    const reason = blockingFilter(rem, opts);
    if (reason === 'price') filters.setBudgetAndCuisine(null, null);
    else if (reason === 'openNow') filters.toggleOpenNow();
    else if (reason === 'diets') filters.clearFilters();
  };
  const stateActions = { widenTo, onWiden: widen, canUndo: actions.lastSwipe !== null && !actions.exiting, onUndo: actions.undoLast };

  return (
    <div className='flex flex-col h-full overflow-hidden relative'>
      <DiscoverHeader
        moodLabel={moodLabel}
        onFilters={() => setSheet('filters')}
        onMood={() => setSheet('mood')}
        position={position}
        address={address}
        onPosition={() => setSheet('position')}
        radius={filters.radius}
        onRadius={() => setSheet('radius')}
      />

      {!isLoading && deck.list.length > 0 && (
        <FilterChips
          openNow={filters.openNow}
          diets={filters.diets}
          onOpenNow={filters.toggleOpenNow}
          onDiet={filters.toggleDietChip}
          count={deckCards.length}
          radius={filters.radius}
          widenTo={widenTo}
          onWiden={widen}
          showCount={!isDeckEmpty}
        />
      )}

      <main className='flex-1 relative flex items-center justify-center min-h-0 pt-3 pb-1'>
        {isLoading ? (
          <DeckLoader />
        ) : isDeckEmpty ? (
          <DeckEnd radius={filters.radius} onMood={() => setSheet('mood')} {...stateActions} />
        ) : noMatch ? (
          <DeckNoMatch reason={blockingFilter(rem, opts)} radius={filters.radius} onFix={fixBlock} {...stateActions} />
        ) : deck.list.length > 0 ? (
          <>
            {/* Première utilisation : la pile oscille deux fois pour montrer le geste. */}
            <div className={`w-full self-stretch flex justify-center ${showHint ? 'card-wobble' : ''}`} style={showHint ? { animationIterationCount: 2 } : undefined}>
              <SwipeDeck ref={deckRef} cards={deckCards} onSwipe={onSwipe} onOpen={openDetails} />
            </div>
            {showHint && (
              <p className='pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-40 chip bg-white text-plum text-xs whitespace-nowrap'>
                Glisse à droite si ça te tente
              </p>
            )}
          </>
        ) : (
          <DeckDesert />
        )}
      </main>

      <ActionButtons
        hidden={isLoading || deck.index < 0 || noMatch}
        onNope={() => deckRef.current?.swipe('left')}
        onLike={() => deckRef.current?.swipe('right')}
        onUndo={actions.undoLast}
        canUndo={stateActions.canUndo}
      />

      {actions.burst.active && <StickerBurst burstId={actions.burst.id} onDone={actions.endBurst} />}

      <DetailSheet rest={selectedRest} onClose={() => setSelectedRest(null)} />

      <FilterSheet
        isOpen={sheet === 'filters'}
        values={{ radius: filters.radius, maxPrice: filters.maxPrice, cuisine: filters.cuisine }}
        cuisines={cuisines}
        onApply={applySheet}
        onClose={closeSheet}
      />
      <MoodSheet isOpen={sheet === 'mood'} onClose={closeSheet} currentMood={moodId} onSelect={handleMoodSelect} />
      <PositionSheet
        open={sheet === 'position'}
        onClose={closeSheet}
        position={position}
        address={address}
        addressStatus={addressStatus}
        onLocate={locate}
        onManual={setManual}
      />
      <RadiusSheet open={sheet === 'radius'} onClose={closeSheet} value={filters.radius} onChange={filters.setRadius} />

      <CasinoOverlay visible={actions.casinoRest !== null} restaurant={actions.casinoRest || ''} onDone={actions.endCasino} />
      <AchievementToast achievement={newAchievement} onDone={clearNewAchievement} />
    </div>
  );
}
