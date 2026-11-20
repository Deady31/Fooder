'use client';
import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { readDislikes, readLikes } from '../../lib/likes';
import { TOUR_XP, dnaProgress } from '../../lib/tour';
import { Sticker } from '../ui/Sticker';

interface TourFinaleProps {
  onClose: () => void;
}

/** Fin du tour : l'XP gagnée et une jauge vers le premier portrait Food DNA (une raison de continuer à swiper). */
export function TourFinale({ onClose }: TourFinaleProps) {
  const [swipes, setSwipes] = useState(0);
  useEffect(() => setSwipes(readLikes().length + readDislikes().length), []);
  const gauge = dnaProgress(swipes);

  return (
    <div className='absolute inset-0 z-[100] flex items-center justify-center px-5 bg-plum/70 pointer-events-auto'>
      <m.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24 }}
        className='w-full max-w-[320px] bg-cream text-plum rounded-[28px] border-[3px] border-plum shadow-hard-lg px-5 py-5 text-center'
        role='group'
        aria-label='Tutoriel terminé'
      >
        <Sticker name='b_star' size={72} rotate={-6} className='mx-auto bob' />
        <h2 className='font-display text-[28px] leading-tight mt-2'>Tu connais l’essentiel !</h2>
        <p className='chip bg-fooder-mint text-plum mt-2 mx-auto w-fit'>+{TOUR_XP} XP</p>

        <div className='mt-4 text-left'>
          <p className='text-sm font-bold leading-snug'>
            {gauge.left > 0
              ? `Ton Food DNA se précise à chaque swipe : encore ${gauge.left} pour ton premier portrait.`
              : 'Ton premier portrait Food DNA est prêt : va le voir dans Profil.'}
          </p>
          <div
            className='mt-2 h-4 rounded-full bg-white border-[3px] border-plum overflow-hidden'
            role='progressbar' aria-valuemin={0} aria-valuemax={gauge.goal} aria-valuenow={gauge.done} aria-label='Swipes vers ton premier portrait Food DNA'
          >
            <m.div
              className='h-full bg-bubblegum'
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(gauge.ratio * 100)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <p className='mt-1 text-[11px] font-black text-plum-muted'>{gauge.done}/{gauge.goal} swipes</p>
        </div>

        <button type='button' onClick={onClose} className='duo-button w-full bg-bubblegum text-plum py-3 mt-4 text-base'>
          C’est parti
        </button>
      </m.div>
    </div>
  );
}
