'use client';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sticker } from '../ui/Sticker';
import { randomStickers } from '../../lib/stickers';

interface StickerBurstProps {
  burstId: number;
  onDone: () => void;
}

const COUNT = 7;

export function StickerBurst({ burstId, onDone }: StickerBurstProps) {
  const items = useMemo(() => {
    const names = randomStickers(COUNT, String(burstId));
    return names.map((name, i) => {
      const angle = (-90 + (i - (COUNT - 1) / 2) * 26) * (Math.PI / 180);
      const dist = 150 + ((i * 37) % 70);
      return { name, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: ((i * 53) % 90) - 45 };
    });
  }, [burstId]);

  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [burstId, onDone]);

  return (
    <div className='pointer-events-none absolute left-1/2 bottom-24 z-[120] -translate-x-1/2'>
      {items.map((it, i) => (
        <motion.div
          key={`${burstId}-${i}`}
          className='absolute -ml-7 -mt-7'
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
          animate={{ x: it.x, y: it.y, scale: 1, opacity: [1, 1, 0], rotate: it.r }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: i * 0.02 }}
        >
          <Sticker name={it.name} size={56} />
        </motion.div>
      ))}
    </div>
  );
}
