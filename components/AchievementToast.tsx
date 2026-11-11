'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Achievement } from '../hooks/useGamification';
import { Sticker } from './ui/Sticker';
import { badgeFor } from '../lib/stickers';

interface Props {
  achievement: Achievement | null;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: Props) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [achievement, onDone]);

  return (
    <AnimatePresence>
      {achievement && (
        <div className="fixed top-3 inset-x-0 z-[300] flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ y: -90, opacity: 0, scale: 0.85, rotate: -3 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ y: -90, opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          className="w-full max-w-xs pointer-events-auto"
          onClick={onDone}
        >
          <div className="bg-fooder-secondary rounded-2xl px-4 py-3 flex items-center gap-3 panel">
            <Sticker name={badgeFor(achievement.id)} size={48} rotate={-8} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-plum/70 uppercase tracking-widest">Trophée débloqué</p>
              <p className="font-display text-lg text-plum leading-tight truncate">{achievement.title}</p>
              <p className="text-plum/70 text-xs font-semibold truncate">{achievement.description}</p>
            </div>
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
