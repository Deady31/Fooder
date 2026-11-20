'use client';
import { useState } from 'react';
import { m } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { EMAIL_MAX, signupEmailProblem } from '../../lib/profile';
import type { Profile } from '../../lib/profile';
import { canFinishOnboarding } from '../../lib/legal';
import { DIET_OPTIONS, labelOf } from './options';

interface FinalStepProps {
  profile: Profile;
  /** Texte saisi dans le champ e-mail (obligatoire pendant la béta, sans confirmation) */
  email: string;
  onEmailChange: (v: string) => void;
  /** Case « J'accepte les Conditions et la Politique de confidentialité » (obligatoire) */
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  /** « C'est parti » : seulement quand l'e-mail est valide et les conditions acceptées */
  onGo: () => void;
}

const STICKERS = ['donut', 'pizza', 'ramen'] as const;

/** Dernier écran : tout tient sans défilement (e-mail, conditions, bouton). */
export function FinalStep({ profile, email, onEmailChange, termsAccepted, onTermsChange, onGo }: FinalStepProps) {
  const [touched, setTouched] = useState(false);

  const chips = profile.diets.map(d => labelOf(DIET_OPTIONS, d)).filter((c): c is string => Boolean(c));
  const problem = signupEmailProblem(email);
  const canFinish = canFinishOnboarding(termsAccepted) && problem === null;
  const shownError = touched ? problem : null;

  const go = () => {
    setTouched(true);
    if (canFinish) onGo();
  };

  return (
    <div className='flex flex-col h-full px-5 pt-1 pb-5 gap-3'>
      <div className='flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center'>
        <div className='flex justify-center items-end -space-x-3 [@media(max-height:640px)]:hidden'>
          {STICKERS.map((s, i) => (
            <m.span key={s} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 10, stiffness: 220, delay: 0.1 + i * 0.07 }}>
              <Sticker name={s} size={60} rotate={(i % 2 ? 1 : -1) * (6 + i * 2)} />
            </m.span>
          ))}
        </div>
        <div className='space-y-1'>
          <p className='text-xs font-black text-fooder-primary uppercase tracking-[0.2em]'>Dernière étape</p>
          <h2 className='text-3xl font-black text-slate-900 tracking-tight leading-tight [overflow-wrap:anywhere]'>
            Bienvenue,<br /><span className='font-display text-fooder-primary'>{profile.pseudo}</span> !
          </h2>
        </div>

        {chips.length > 0 && (
          <div className='flex flex-wrap justify-center gap-2 max-w-xs'>
            {chips.map((c, i) => (
              <span key={`${c}${i}`} className={`chip ${i % 2 ? 'bg-fooder-secondary' : 'bg-bubblegum'} text-plum`}>{c}</span>
            ))}
          </div>
        )}

        <div className='w-full max-w-xs rounded-2xl border-[3px] border-plum bg-white shadow-hard px-3 py-3 text-left space-y-2'>
          <label htmlFor='onboarding-email' className='block text-sm font-black text-plum'>Ton e-mail</label>
          <input
            id='onboarding-email'
            type='email'
            inputMode='email'
            autoComplete='email'
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
            enterKeyHint='done'
            required
            maxLength={EMAIL_MAX}
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }}
            placeholder='toi@exemple.fr'
            aria-invalid={shownError !== null}
            aria-describedby='onboarding-email-help'
            className={`w-full rounded-xl border-[3px] bg-cream px-3 py-2.5 text-base font-semibold text-plum placeholder:text-slate-300 focus:outline-none focus:bg-fooder-secondary/30 ${shownError ? 'border-fooder-red' : 'border-plum'}`}
          />
          <p id='onboarding-email-help' role={shownError ? 'alert' : undefined}
            className={`text-xs font-semibold leading-snug ${shownError ? 'text-danger' : 'text-slate-muted'}`}>
            {shownError ?? 'Pour retrouver ton compte. On ne t’envoie rien pour l’instant.'}
          </p>
        </div>

        <label htmlFor='onboarding-terms' className='w-full max-w-xs flex items-start gap-3 min-h-[44px] cursor-pointer text-left'>
          <input id='onboarding-terms' type='checkbox' checked={termsAccepted} onChange={e => onTermsChange(e.target.checked)} required
            className='mt-0.5 w-6 h-6 shrink-0 accent-[#6C2BFF] rounded border-[3px] border-plum' />
          <span className='text-sm font-semibold text-plum leading-snug'>
            J&apos;accepte les{' '}
            <a href='/legal/terms' target='_blank' rel='noopener noreferrer' className='underline font-black'>Conditions d&apos;utilisation</a>{' '}
            et la{' '}
            <a href='/legal/privacy' target='_blank' rel='noopener noreferrer' className='underline font-black'>Politique de confidentialité</a>.
          </span>
        </label>
      </div>

      <m.button type='button' onClick={go} disabled={!canFinish} whileTap={canFinish ? { scale: 0.97 } : undefined}
        className={`w-full duo-button text-xl py-4 flex-shrink-0 flex items-center justify-center gap-2 ${
          canFinish ? 'bg-fooder-primary border-fooder-primary text-white' : 'bg-white border-slate-300 text-slate-400 cursor-not-allowed'
        }`}>
        C&apos;est parti ! <ChevronRight className='w-6 h-6' />
      </m.button>
    </div>
  );
}
