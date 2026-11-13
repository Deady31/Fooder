'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Achievement } from '../hooks/useGamification';
import { Sticker } from './ui/Sticker';
import { badgeFor, StickerName } from '../lib/stickers';

interface Props {
  achievement: Achievement | null;
  onDone: () => void;
  /** Surtitre (« Trophée débloqué » par défaut, « Mission accomplie » pour les missions). */
  label?: string;
  /** Autocollant affiché (badge du succès par défaut). */
  sticker?: StickerName;
  /** Pastille à droite, ex. « +25 XP ». */
  badge?: string;
  /** Durée d'affichage en ms. */
  duration?: number;
}

export const TOAST_MS = 3500;

/**
 * Toast de succès. Le minuteur dépend seulement du succès affiché : `onDone` est lu via une ref,
 * donc un re-rendu du parent (swipe) ne le relance plus.
 */
export function AchievementToast({ achievement, onDone, label = 'Trophée débloqué', sticker, badge, duration = TOAST_MS }: Props) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(() => onDoneRef.current(), duration);
    return () => clearTimeout(t);
  }, [achievement, duration]);

  return (
    <AnimatePresence>
      {achievement && (
        <div className='fixed top-3 inset-x-0 z-[300] flex justify-center px-4 pointer-events-none'>
          <motion.button
            type='button'
            key={achievement.id}
            initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.85, rotate: -3 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 18, stiffness: 420 }}
            className='w-full max-w-xs pointer-events-auto text-left'
            onClick={() => onDoneRef.current()}
            aria-label={`${label} : ${achievement.title}. Toucher pour fermer.`}
          >
            <div className='bg-fooder-secondary rounded-2xl px-4 py-3 flex items-center gap-3 panel'>
              <motion.span
                className='flex-shrink-0'
                initial={reduce ? false : { scale: 0.3, rotate: -30 }}
                animate={reduce ? undefined : { scale: [0.3, 1.2, 1], rotate: [-30, 8, -8] }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <Sticker name={sticker ?? badgeFor(achievement.id)} size={48} />
              </motion.span>
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] font-black text-plum uppercase tracking-widest'>{label}</p>
                <p className='font-display text-lg text-plum leading-tight truncate'>{achievement.title}</p>
                <p className='text-plum text-xs font-semibold truncate opacity-80'>{achievement.description}</p>
              </div>
              {badge && (
                <span className='chip bg-white text-plum flex-shrink-0 font-display !text-sm'>{badge}</span>
              )}
            </div>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
