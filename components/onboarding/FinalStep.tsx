'use client';
import { motion } from 'framer-motion';
import { ChevronRight, Heart, Pointer, X } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { CUISINE_OPTIONS } from '../../lib/profile';
import type { Profile } from '../../lib/profile';
import { AGE_OPTIONS, BUDGET_OPTIONS, DIET_OPTIONS, VIBE_OPTIONS, labelOf } from './options';

interface FinalStepProps {
  profile: Profile;
  onGo: () => void;
}

const TIPS = [
  { icon: <Heart className='w-4 h-4 text-fooder-primary fill-white' strokeWidth={3} />, text: 'Glisse à droite si ça te tente' },
  { icon: <X className='w-4 h-4 text-fooder-red' strokeWidth={4} />, text: 'À gauche si c’est niet' },
  { icon: <Pointer className='w-4 h-4 text-plum fill-white' strokeWidth={2.5} />, text: 'Maintiens pour tout voir' },
];

export function FinalStep({ profile, onGo }: FinalStepProps) {
  const picked = profile.cuisines
    .map(id => CUISINE_OPTIONS.find(c => c.id === id))
    .filter((c): c is (typeof CUISINE_OPTIONS)[number] => Boolean(c));
  const chips = [
    labelOf(AGE_OPTIONS, profile.ageRange),
    labelOf(BUDGET_OPTIONS, profile.budget)?.split('  ')[0] ?? null,
    profile.quartier,
    ...profile.diets.map(d => labelOf(DIET_OPTIONS, d)),
    ...profile.vibes.map(v => labelOf(VIBE_OPTIONS, v)),
  ].filter((c): c is string => Boolean(c));

  return (
    <div className='flex flex-col h-full px-5 pt-1 pb-6'>
      <div className='flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center justify-center gap-5 text-center'>
        <div className='flex justify-center items-end -space-x-3 min-h-[76px]'>
          {(picked.length > 0 ? picked.map(c => c.sticker) : (['donut', 'pizza', 'ramen'] as const)).slice(0, 5).map((s, i) => (
            <motion.span key={`${s}${i}`} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 10, stiffness: 220, delay: 0.1 + i * 0.07 }}>
              <Sticker name={s} size={72} rotate={(i % 2 ? 1 : -1) * (6 + i * 2)} />
            </motion.span>
          ))}
        </div>
        <div className='space-y-1.5'>
          <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Tout est prêt</p>
          <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight'>
            Bienvenue,<br /><span className='font-display text-fooder-primary'>{profile.pseudo}</span> !
          </h2>
          <p className='text-slate-500 font-medium text-sm'>Ton assiette idéale t&apos;attend. Voilà ce qu&apos;on a retenu :</p>
        </div>

        {chips.length > 0 && (
          <div className='flex flex-wrap justify-center gap-2 max-w-xs'>
            {chips.map((c, i) => (
              <motion.span key={`${c}${i}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className={`chip ${i % 2 ? 'bg-fooder-secondary' : 'bg-bubblegum'} text-plum`}>
                {c}
              </motion.span>
            ))}
          </div>
        )}

        <ul className='space-y-2 text-sm font-semibold text-slate-600'>
          {TIPS.map((t, i) => (
            <li key={i} className='flex items-center justify-center gap-2'>
              <span className='w-7 h-7 rounded-full bg-white border-[3px] border-plum flex items-center justify-center'>{t.icon}</span>
              {t.text}
            </li>
          ))}
        </ul>
      </div>

      <motion.button type='button' onClick={onGo} whileTap={{ scale: 0.97 }}
        className='w-full duo-button bg-fooder-primary border-fooder-primary text-white text-xl py-5 mt-3 flex-shrink-0 flex items-center justify-center gap-2'>
        C&apos;est parti ! <ChevronRight className='w-6 h-6' />
      </motion.button>
    </div>
  );
}
