'use client';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  EMPTY_QUEUE, GAP_MS, XpBubble, announceFor, coalesceXp, onCelebration, queueReducer,
} from '../../lib/celebrations';
import { feedback } from '../../lib/feedback';
import type { StickerName } from '../../lib/stickers';
import { AchievementToast } from '../AchievementToast';
import { LevelUp } from './LevelUp';
import { XpFloat } from './XpFloat';

const MISSION_STICKER: StickerName = 'sparkle';

/**
 * Hôte global des célébrations, à monter UNE fois (layout `(app)`).
 * Écoute le bus : les gains d'XP s'envolent (XpFloat, regroupés), le reste passe par une file à priorités
 * (niveau > succès = mission), un élément à la fois, avec une pause entre deux.
 */
export function CelebrationHost() {
  const [state, dispatch] = useReducer(queueReducer, EMPTY_QUEUE);
  const [bubble, setBubble] = useState<XpBubble | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(
    () =>
      onCelebration(event => {
        setAnnounce(announceFor(event));
        if (event.type === 'xp') {
          const now = Date.now();
          setBubble(prev => coalesceXp(prev, event, now));
          return;
        }
        dispatch({ type: 'enqueue', event });
      }),
    []
  );

  // Pause entre deux éléments, puis le suivant.
  useEffect(() => {
    if (!state.resting) return;
    const t = setTimeout(() => dispatch({ type: 'advance' }), GAP_MS);
    return () => clearTimeout(t);
  }, [state.resting]);

  // Retour sensoriel à l'apparition d'un toast (le plein écran de niveau gère le sien).
  const currentKey = state.current?.key;
  const currentType = state.current?.event.type;
  useEffect(() => {
    if (currentType === 'achievement' || currentType === 'mission') feedback('success');
  }, [currentKey, currentType]);

  const done = useCallback(() => dispatch({ type: 'done' }), []);
  const clearBubble = useCallback(() => setBubble(null), []);

  const ev = state.current?.event ?? null;
  // Objet stable par élément affiché : le minuteur du toast ne repart pas à chaque rendu de l'hôte.
  const toast = useMemo(() =>
    ev?.type === 'achievement'
      ? { achievement: { id: ev.id, title: ev.title, description: ev.description, emoji: '' }, label: 'Trophée débloqué', badge: undefined, sticker: undefined }
      : ev?.type === 'mission'
        ? {
            achievement: { id: `mission-${ev.id}`, title: ev.title, description: `${ev.done}/${ev.total} missions du jour`, emoji: '' },
            label: 'Mission accomplie',
            badge: `+${ev.xpReward} XP`,
            sticker: MISSION_STICKER,
          }
        : null,
  [currentKey]); // ev ne change qu'avec currentKey

  return (
    <>
      <XpFloat bubble={bubble} onDone={clearBubble} />

      <AchievementToast
        achievement={toast?.achievement ?? null}
        label={toast?.label}
        badge={toast?.badge}
        sticker={toast?.sticker}
        onDone={done}
      />

      <AnimatePresence>
        {ev?.type === 'level' && <LevelUp key={state.current!.key} event={ev} onDone={done} />}
      </AnimatePresence>

      <p className='sr-only' role='status' aria-live='polite' aria-atomic='true'>
        {announce}
      </p>
    </>
  );
}
