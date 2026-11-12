'use client';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { Logo } from '../ui/Logo';
import type { StickerName } from '../../lib/stickers';

const FLOATERS: { sticker: StickerName; top: string; left?: string; right?: string; cls: string; delay: string; size: number; rot: number }[] = [
  { sticker: 'pizza', top: '8%', left: '4%', cls: 'float-a', delay: '0s', size: 92, rot: -12 },
  { sticker: 'ramen', top: '14%', right: '4%', cls: 'float-b', delay: '0.4s', size: 88, rot: 10 },
  { sticker: 'salad', top: '84%', left: '4%', cls: 'float-c', delay: '0.8s', size: 76, rot: -8 },
  { sticker: 'burger', top: '82%', right: '4%', cls: 'float-a', delay: '1.2s', size: 84, rot: 12 },
  { sticker: 'donut', top: '36%', left: '6%', cls: 'float-b', delay: '0.2s', size: 64, rot: 8 },
  { sticker: 'icecream', top: '40%', right: '6%', cls: 'float-c', delay: '1s', size: 70, rot: -10 },
];

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className='flex flex-col items-center justify-center h-full px-6 relative overflow-hidden'>
      {FLOATERS.map((f, i) => (
        <span key={i} className={`absolute select-none pointer-events-none ${f.cls}`}
          style={{ top: f.top, left: f.left, right: f.right, animationDelay: f.delay }}>
          <Sticker name={f.sticker} size={f.size} rotate={f.rot} />
        </span>
      ))}
      <div className='relative z-10 text-center space-y-6 flex flex-col items-center'>
        <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}>
          <h1><Logo className='w-[min(78vw,320px)]' /></h1>
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className='font-display text-4xl text-plum leading-tight'>
          Swipe.<br />Mange.<br />Répète.
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className='text-slate-500 font-medium text-base max-w-xs leading-relaxed'>
          Trouve ton prochain resto en moins de 30 secondes. Dis-nous qui tu es, on s&apos;occupe de ton assiette.
        </motion.p>
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          onClick={onNext}
          className='w-full max-w-xs duo-button bg-fooder-primary border-fooder-primary text-white text-xl py-5 flex items-center justify-center gap-2'>
          Créer mon profil <ChevronRight className='w-6 h-6' />
        </motion.button>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className='text-slate-400 text-xs font-medium'>
          Gratuit · 1 minute chrono
        </motion.p>
      </div>
    </div>
  );
}
