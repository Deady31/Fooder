'use client';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Camera, Heart, Trophy, Zap } from 'lucide-react';
import { StepFrame } from './StepFrame';
import { Sticker } from '../ui/Sticker';
import { PHOTO_XP_FIRST } from '../../lib/photoXp';
import type { StickerName } from '../../lib/stickers';

interface Point {
  icon: ReactNode;
  sticker: StickerName;
  title: string;
  text: ReactNode;
  bg: string;
  rot: number;
}

const ICON = 'w-5 h-5 text-plum';

const POINTS: Point[] = [
  {
    icon: <Camera className={ICON} strokeWidth={2.5} />, sticker: 'burger', bg: 'bg-bubblegum', rot: -1.5,
    title: 'Les photos, c’est toi !',
    text: 'Poste le plat que tu manges, pas la devanture.',
  },
  {
    icon: <Zap className={ICON} strokeWidth={2.5} />, sticker: 'b_bolt', bg: 'bg-lemon', rot: 1.2,
    title: 'De l’XP à chaque photo',
    text: <>+{PHOTO_XP_FIRST} XP pour la première photo d’un resto.</>,
  },
  {
    icon: <Heart className={ICON} strokeWidth={2.5} />, sticker: 'b_heart', bg: 'bg-fooder-secondary', rot: -1,
    title: 'La plus aimée gagne',
    text: 'La photo avec le plus de cœurs devient celle de tous les utilisateurs.',
  },
  {
    icon: <Trophy className={ICON} strokeWidth={2.5} />, sticker: 'b_trophy', bg: 'bg-fooder-mint', rot: 1.4,
    title: 'Le classement',
    text: 'Compare-toi aux autres foodies de la ville.',
  },
];

/** Étape « Tu nous aides » : explique le principe des photos communautaires avant l'écran final. */
export function HelpStep({ onNext }: { onNext: () => void }) {
  return (
    <StepFrame
      kicker='Tu nous aides'
      title={<>Fooder, c&apos;est<br />ton appareil photo</>}
      subtitle='Les plus belles photos de plats, ce sont les tiennes.'
      sticker='donut'
      cta='Compris !'
      onCta={onNext}
      centered
    >
      <ul className='space-y-3'>
        {POINTS.map((p, i) => (
          <motion.li
            key={p.title}
            initial={{ opacity: 0, y: 18, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: p.rot }}
            transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.12 + i * 0.08 }}
            className={`flex items-center gap-3 rounded-2xl border-[3px] border-plum shadow-hard px-3 py-2.5 ${p.bg}`}
          >
            <span className='w-9 h-9 shrink-0 rounded-full bg-white border-[3px] border-plum flex items-center justify-center'>{p.icon}</span>
            <span className='min-w-0 flex-1 text-left'>
              <span className='block font-black text-plum text-sm leading-tight'>{p.title}</span>
              <span className='block text-xs font-semibold text-plum/75 leading-snug'>{p.text}</span>
            </span>
            <Sticker name={p.sticker} size={40} rotate={i % 2 ? 8 : -8} className='shrink-0' />
          </motion.li>
        ))}
      </ul>
    </StepFrame>
  );
}
