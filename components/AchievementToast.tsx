'use client';
import { useEffect, useRef } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
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
          <m.div
            role='status'
            key={achievement.id}
            initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.85, rotate: -3 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 18, stiffness: 420 }}
            className='w-full max-w-xs pointer-events-auto text-left'
          >
            <div className='bg-fooder-secondary rounded-2xl px-4 py-3 flex items-center gap-3 panel'>
              <m.span
                className='flex-shrink-0'
                initial={reduce ? false : { scale: 0.3, rotate: -30 }}
                animate={reduce ? undefined : { scale: [0.3, 1.2, 1], rotate: [-30, 8, -8] }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <Sticker name={sticker ?? badgeFor(achievement.id)} size={48} />
              </m.span>
              <div className='flex-1 min-w-0'>
                <p className='text-[10px] font-black text-plum uppercase tracking-widest'>{label}</p>
                {/* Texte en entier : il passe à la ligne, la police se réduit s'il est long, jamais de « … ». */}
                <p className={`font-display text-plum leading-tight break-words ${achievement.title.length > 28 ? 'text-base' : 'text-lg'}`}>{achievement.title}</p>
                <p className={`text-plum font-semibold leading-snug break-words opacity-80 ${achievement.description.length > 70 ? 'text-[11px]' : 'text-xs'}`}>{achievement.description}</p>
              </div>
              {badge && (
                <span className='chip bg-white text-plum flex-shrink-0 font-display !text-sm'>{badge}</span>
              )}
              <button
                type='button'
                onClick={() => onDoneRef.current()}
                aria-label='Fermer'
                className='flex-shrink-0 self-start -mt-1 -mr-2 w-10 h-10 flex items-center justify-center rounded-full text-plum active:bg-white/60'
              >
                <X className='w-5 h-5' strokeWidth={3} aria-hidden='true' />
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
