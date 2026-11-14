'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FlyingHeartProps {
  /** Change à chaque like : relance l'animation. */
  burstId: number;
  onDone: () => void;
}

/** Cœur qui s'envole du bas de la carte vers l'onglet Favoris (ou en haut à droite si introuvable). */
export function FlyingHeart({ burstId, onDone }: FlyingHeartProps) {
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const tab = document.querySelector<HTMLElement>('[data-tab="/wishlist"]');
    const r = tab?.getBoundingClientRect();
    const targetX = r ? r.left + r.width / 2 : window.innerWidth * 0.7;
    const targetY = r ? r.top + r.height / 2 : window.innerHeight - 30;
    setTo({ x: targetX - window.innerWidth / 2, y: targetY - window.innerHeight * 0.55 });
    const t = setTimeout(onDone, 750);
    return () => clearTimeout(t);
  }, [burstId, onDone]);

  if (!to) return null;
  return (
    <div className='pointer-events-none fixed left-1/2 z-[121]' style={{ top: '55%' }} aria-hidden='true'>
      <motion.span
        key={burstId}
        className='absolute -ml-5 -mt-5 text-4xl leading-none'
        initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
        animate={{ x: to.x, y: to.y, scale: [0.4, 1.4, 0.6], opacity: [1, 1, 0] }}
        transition={{ duration: 0.7, ease: [0.5, 0, 0.3, 1] }}
      >
        ❤️
      </motion.span>
    </div>
  );
}
