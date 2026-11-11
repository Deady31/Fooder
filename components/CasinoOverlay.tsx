'use client';
import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sticker } from './ui/Sticker';
import { FOOD_STICKERS } from '../lib/stickers';

interface Props {
  visible: boolean;
  restaurant: string;
  onDone: () => void;
}

const PARTICLES = 14;

export function CasinoOverlay({ visible, restaurant, onDone }: Props) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const dist = 120 + ((i * 41) % 130);
        return {
          name: FOOD_STICKERS[(i * 5) % FOOD_STICKERS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          r: ((i * 67) % 120) - 60,
          delay: (i % 5) * 0.05,
        };
      }),
    [visible]
  );

  useEffect(() => {
    if (!visible) return;
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate([80, 40, 80, 40, 200]);
    }
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-fooder-primary"
          onClick={onDone}
        >
          {particles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{ top: '50%', left: '50%', marginLeft: -32, marginTop: -32 }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, scale: [0, 1.2, 1], opacity: [1, 1, 0.9], rotate: p.r }}
              transition={{ duration: 1.4, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            >
              <Sticker name={p.name} size={64} />
            </motion.div>
          ))}

          <motion.div
            initial={{ scale: 0.3, rotate: -14 }}
            animate={{ scale: [0.3, 1.18, 1], rotate: [-14, 6, -2] }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-center space-y-4 z-10 px-6"
          >
            <p className="font-display text-xl text-fooder-secondary tracking-wider">JACKPOT FOODIE !</p>
            <div className="bg-cream rounded-[28px] px-7 py-6 panel space-y-2">
              <p className="font-display text-3xl text-plum leading-tight">{restaurant}</p>
              <p className="text-plum/70 text-sm font-bold">C&apos;est TON restaurant du destin</p>
            </div>
            <p className="text-white/70 text-xs font-semibold">Tape pour continuer</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
