'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sticker } from '../ui/Sticker';

interface StepProgressProps {
  index: number;
  total: number;
}

const SPRING = { type: 'spring' as const, stiffness: 120, damping: 18 };
const PARTICLES = 6;

function Burst() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(t);
  }, []);
  const items = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2 + 0.4;
        const dist = 22 + (i % 3) * 8;
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 12 + (i % 2) * 6, delay: i * 0.02 };
      }),
    []
  );
  if (!visible) return null;
  return (
    <>
      {items.map((p, i) => (
        <motion.span
          key={i}
          className='absolute left-1/2 top-1/2 -ml-2 -mt-2 pointer-events-none'
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, scale: 1, opacity: 0, rotate: 120 }}
          transition={{ duration: 0.7, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        >
          <Sticker name='sparkle' size={p.size} />
        </motion.span>
      ))}
    </>
  );
}

export function StepProgress({ index, total }: StepProgressProps) {
  const pct = ((index + 1) / total) * 100;

  return (
    <div
      className='relative flex-1 h-5'
      role='progressbar'
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      aria-label={`Étape ${index + 1} sur ${total}`}
    >
      <div className='absolute inset-0 rounded-full bg-white border-[3px] border-plum overflow-hidden'>
        <motion.div
          className='h-full bg-bubblegum stripes'
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={SPRING}
        />
        {Array.from({ length: total - 1 }, (_, i) => (
          <span
            key={i}
            className='absolute top-0 bottom-0 w-[3px] bg-plum/60'
            style={{ left: `${((i + 1) / total) * 100}%` }}
          />
        ))}
      </div>

      <motion.div
        className='absolute top-1/2 z-10'
        initial={false}
        animate={{ left: `${pct}%` }}
        transition={SPRING}
      >
        <div className='relative w-[34px] h-[34px] -translate-x-1/2 -translate-y-1/2'>
          <motion.div
            animate={{ rotate: [0, 90, 180], scale: [1, 1.22, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sticker name='sparkle' size={34} />
          </motion.div>
          <AnimatePresence>
            <Burst key={index} />
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
