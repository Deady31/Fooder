'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import type { StickerName } from '../../lib/stickers';

export type ChoiceLayout = 'row' | 'tile' | 'pill';

interface ChoiceProps {
  label: string;
  sub?: string;
  sticker?: StickerName;
  selected: boolean;
  disabled?: boolean;
  layout?: ChoiceLayout;
  index?: number;
  onClick: () => void;
}

const BASE = 'relative border-[3px] border-plum transition-all active:translate-y-1 active:shadow-none';

/** Grosse puce tactile : carte avec sticker, ombre dure, enfoncée une fois choisie. */
export function Choice({ label, sub, sticker, selected, disabled, layout = 'row', index = 0, onClick }: ChoiceProps) {
  const state = selected ? 'bg-fooder-secondary translate-y-1' : disabled ? 'bg-white/60 opacity-50' : 'bg-white shadow-hard';
  const shape =
    layout === 'tile'
      ? 'rounded-2xl flex flex-col items-center gap-1 px-1 pt-2 pb-2 text-center'
      : layout === 'pill'
        ? 'rounded-full px-4 py-2 flex items-center gap-1.5'
        : 'rounded-2xl flex items-center gap-3 pl-3 pr-4 py-2.5 text-left w-full';

  return (
    <motion.button
      type='button'
      role='checkbox'
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4), type: 'spring', damping: 18, stiffness: 260 }}
      className={`${BASE} ${state} ${shape}`}
    >
      {sticker && layout !== 'pill' && <Sticker name={sticker} size={layout === 'tile' ? 52 : 46} rotate={selected ? 6 : -6} />}
      <span className='min-w-0'>
        <span className={`block font-bold leading-tight text-plum ${layout === 'tile' ? 'text-[13px]' : 'text-base'}`}>{label}</span>
        {sub && <span className='block text-xs font-medium text-slate-500 mt-0.5 leading-tight'>{sub}</span>}
      </span>
      {selected && (
        <span className='absolute -top-2 -right-2 w-6 h-6 rounded-full bg-fooder-primary border-[3px] border-plum flex items-center justify-center'>
          <Check className='w-3 h-3 text-white' strokeWidth={4} />
        </span>
      )}
    </motion.button>
  );
}
