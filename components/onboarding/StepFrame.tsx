'use client';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import type { StickerName } from '../../lib/stickers';

interface StepFrameProps {
  kicker: string;
  title: ReactNode;
  subtitle?: string;
  sticker?: StickerName;
  children: ReactNode;
  cta: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  /** Mise en page centrée verticalement (sinon liste défilante) */
  centered?: boolean;
  /** Action secondaire sous le bouton principal (ex. « Plus tard ») */
  secondary?: ReactNode;
}

/** Cadre commun des écrans d'inscription : en-tête, contenu défilant, bouton principal. */
export function StepFrame({ kicker, title, subtitle, sticker, children, cta, onCta, ctaDisabled, centered, secondary }: StepFrameProps) {
  return (
    <div className='flex flex-col h-full px-5 pt-1 pb-6'>
      <div className='text-center space-y-1.5 flex-shrink-0 pb-4'>
        {sticker && (
          <motion.div
            className='flex justify-center -mb-1'
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 11, stiffness: 220, delay: 0.1 }}
          >
            <Sticker name={sticker} size={64} rotate={-8} />
          </motion.div>
        )}
        <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>{kicker}</p>
        <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>{title}</h2>
        {subtitle && <p className='text-slate-500 font-medium text-sm max-w-xs mx-auto leading-snug'>{subtitle}</p>}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-1 px-1 pb-2 ${centered ? 'flex flex-col justify-center' : ''}`}>
        {children}
      </div>

      <motion.button
        type='button'
        onClick={onCta}
        disabled={ctaDisabled}
        whileTap={ctaDisabled ? undefined : { scale: 0.97 }}
        className={`w-full duo-button text-lg py-4 mt-3 flex-shrink-0 flex items-center justify-center gap-2 transition-colors ${
          ctaDisabled ? 'bg-white border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-fooder-primary border-fooder-primary text-white'
        }`}
      >
        {cta} <ChevronRight className='w-5 h-5' />
      </motion.button>
      {secondary}
    </div>
  );
}
