'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Heart, Pointer, X } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { EMAIL_MAX, EMAIL_MESSAGES, validateEmail } from '../../lib/profile';
import type { Profile } from '../../lib/profile';
import { canFinishOnboarding } from '../../lib/legal';
import { AGE_OPTIONS, DIET_OPTIONS, labelOf } from './options';

interface FinalStepProps {
  profile: Profile;
  /** Texte saisi dans le champ e-mail (facultatif) */
  email: string;
  onEmailChange: (v: string) => void;
  /** Case « J'accepte les Conditions et la Politique de confidentialité » (obligatoire) */
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  /** « C'est parti » : l'e-mail saisi, s'il y en a un, est conservé */
  onGo: () => void;
  /** « Passer » : on entre dans l'app sans e-mail, jamais bloquant */
  onSkip: () => void;
}

const TIPS = [
  { icon: <Heart className='w-4 h-4 text-fooder-primary fill-white' strokeWidth={3} />, text: 'Glisse à droite si ça te tente' },
  { icon: <X className='w-4 h-4 text-fooder-red' strokeWidth={4} />, text: 'À gauche si c’est niet' },
  { icon: <Pointer className='w-4 h-4 text-plum fill-white' strokeWidth={2.5} />, text: 'Maintiens pour tout voir' },
];

const STICKERS = ['donut', 'pizza', 'ramen'] as const;

export function FinalStep({ profile, email, onEmailChange, termsAccepted, onTermsChange, onGo, onSkip }: FinalStepProps) {
  const [error, setError] = useState<string | null>(null);

  const chips = [
    labelOf(AGE_OPTIONS, profile.ageRange),
    ...profile.diets.map(d => labelOf(DIET_OPTIONS, d)),
  ].filter((c): c is string => Boolean(c));

  const canFinish = canFinishOnboarding(termsAccepted);

  const go = () => {
    if (!canFinish) return;
    const res = validateEmail(email);
    if (!res.ok) {
      setError(EMAIL_MESSAGES[res.reason]);
      return;
    }
    onGo();
  };

  return (
    <div className='flex flex-col h-full px-5 pt-1 pb-6'>
      <div className='flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center justify-center gap-4 text-center'>
        <div className='flex justify-center items-end -space-x-3 min-h-[76px]'>
          {STICKERS.map((s, i) => (
            <motion.span key={s} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
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
          <p className='text-slate-500 font-medium text-sm'>Tes goûts, on les apprend à chaque swipe.</p>
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

        <div className='w-full max-w-xs rounded-2xl border-[3px] border-plum bg-white shadow-hard px-3 py-3 text-left space-y-2'>
          <label htmlFor='onboarding-email' className='block text-sm font-black text-plum'>Ton e-mail (facultatif)</label>
          <input
            id='onboarding-email'
            type='email'
            inputMode='email'
            autoComplete='email'
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
            enterKeyHint='done'
            maxLength={EMAIL_MAX}
            value={email}
            onChange={e => { onEmailChange(e.target.value); if (error) setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }}
            placeholder='toi@exemple.fr'
            aria-invalid={error !== null}
            aria-describedby='onboarding-email-help'
            className={`w-full rounded-xl border-[3px] bg-cream px-3 py-2.5 text-base font-semibold text-plum placeholder:text-slate-300 focus:outline-none focus:bg-fooder-secondary/30 ${error ? 'border-fooder-red' : 'border-plum'}`}
          />
          <p id='onboarding-email-help' role={error ? 'alert' : undefined}
            className={`text-xs font-semibold leading-snug ${error ? 'text-fooder-red' : 'text-slate-500'}`}>
            {error ?? 'Pour retrouver ton compte plus tard. On ne t’envoie rien pour l’instant.'}
          </p>
          <button type='button' onClick={onSkip} disabled={!canFinish}
            className='w-full rounded-xl border-[3px] border-plum bg-white py-2 text-sm font-black text-plum active:translate-y-0.5 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed'>
            Passer
          </button>
        </div>

        <div className='w-full max-w-xs text-left'>
          <label htmlFor='onboarding-terms' className='flex items-start gap-3 min-h-[44px] cursor-pointer'>
            <input id='onboarding-terms' type='checkbox' checked={termsAccepted} onChange={e => onTermsChange(e.target.checked)}
              aria-describedby='onboarding-terms-help' required
              className='mt-0.5 w-6 h-6 shrink-0 accent-[#6C2BFF] rounded border-[3px] border-plum' />
            <span className='text-sm font-semibold text-plum leading-snug'>
              J&apos;accepte les{' '}
              <a href='/legal/terms' target='_blank' rel='noopener noreferrer' className='underline font-black'>Conditions d&apos;utilisation</a>{' '}
              et la{' '}
              <a href='/legal/privacy' target='_blank' rel='noopener noreferrer' className='underline font-black'>Politique de confidentialité</a>.
            </span>
          </label>
          <p id='onboarding-terms-help' role='status' className={`text-xs font-bold leading-snug pl-9 ${canFinish ? 'text-slate-500' : 'text-fooder-red'}`}>
            {canFinish ? 'Merci ! Les liens s’ouvrent dans un nouvel onglet.' : 'Coche cette case pour entrer dans Fooder. Les liens s’ouvrent dans un nouvel onglet.'}
          </p>
        </div>

        <ul className='space-y-2 text-sm font-semibold text-slate-600'>
          {TIPS.map((t, i) => (
            <li key={i} className='flex items-center justify-center gap-2'>
              <span className='w-7 h-7 rounded-full bg-white border-[3px] border-plum flex items-center justify-center'>{t.icon}</span>
              {t.text}
            </li>
          ))}
        </ul>
      </div>

      <motion.button type='button' onClick={go} disabled={!canFinish} whileTap={canFinish ? { scale: 0.97 } : undefined}
        className={`w-full duo-button text-xl py-5 mt-3 flex-shrink-0 flex items-center justify-center gap-2 ${
          canFinish ? 'bg-fooder-primary border-fooder-primary text-white' : 'bg-white border-slate-300 text-slate-400 cursor-not-allowed'
        }`}>
        C&apos;est parti ! <ChevronRight className='w-6 h-6' />
      </motion.button>
    </div>
  );
}
