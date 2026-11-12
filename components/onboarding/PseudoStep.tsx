'use client';
import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices } from 'lucide-react';
import { StepFrame } from './StepFrame';
import { PSEUDO_MAX, PSEUDO_MESSAGES, suggestPseudo, validatePseudo } from '../../lib/pseudo';

interface PseudoStepProps {
  value: string;
  onChange: (v: string) => void;
  onNext: (validated: string) => void;
}

export function PseudoStep({ value, onChange, onNext }: PseudoStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const res = validatePseudo(value);
    if (res.ok) {
      setError(null);
      onNext(res.value);
    } else {
      setError(PSEUDO_MESSAGES[res.reason]);
      setShake(s => s + 1);
    }
  };

  return (
    <StepFrame
      kicker='Première chose'
      title={<>Comment on<br />t&apos;appelle ?</>}
      subtitle="Ton pseudo, c'est ta signature de gourmand."
      sticker='donut'
      cta='Continuer'
      onCta={submit}
      centered
    >
      <form onSubmit={submit} className='space-y-3'>
        <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : undefined} transition={{ duration: 0.4 }}>
          <input
            value={value}
            onChange={e => { onChange(e.target.value); if (error) setError(null); }}
            maxLength={PSEUDO_MAX}
            autoFocus
            autoComplete='off'
            autoCapitalize='none'
            autoCorrect='off'
            spellCheck={false}
            enterKeyHint='next'
            placeholder='TonPseudo'
            aria-label='Ton pseudo'
            aria-invalid={error !== null}
            className={`w-full rounded-2xl border-[3px] bg-white px-4 py-4 text-center text-2xl font-display text-plum placeholder:text-slate-300 shadow-hard focus:outline-none focus:bg-fooder-secondary/30 ${error ? 'border-fooder-red' : 'border-plum'}`}
          />
        </motion.div>
        <div className='flex items-center justify-between text-xs font-semibold px-1 min-h-[2.25rem]'>
          <p role='alert' className={`flex-1 pr-3 ${error ? 'text-fooder-red' : 'text-slate-400'}`}>
            {error ?? '3 à 16 caractères : lettres, chiffres, . _ -'}
          </p>
          <span className='text-slate-400 tabular-nums'>{Array.from(value).length}/{PSEUDO_MAX}</span>
        </div>
        <button
          type='button'
          onClick={() => { onChange(suggestPseudo()); setError(null); }}
          className='mx-auto flex items-center gap-2 chip bg-white text-plum'
        >
          <Dices className='w-4 h-4' /> Pas d&apos;idée ? Tire au sort
        </button>
        <button type='submit' className='sr-only'>Continuer</button>
      </form>
    </StepFrame>
  );
}
