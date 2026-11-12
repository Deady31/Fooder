'use client';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { DEFAULT_FUNNEL, FunnelStep, formatDuration, formatNumber, formatPct, parseSteps } from '../../lib/admin/metrics';
import type { EventNameRow } from '../../lib/admin/types';
import { ChipButton, Empty } from './ui';

const PRESETS: Array<{ label: string; steps: string[] }> = [
  { label: 'Cœur produit', steps: DEFAULT_FUNNEL },
  { label: 'Social', steps: ['session_start', 'share', 'friend_added', 'group_joined'] },
  { label: 'Compte', steps: ['session_start', 'swipe_like', 'auth_code_sent', 'signup'] },
];

interface FunnelViewProps {
  steps: FunnelStep[];
  current: string[];
  events: EventNameRow[];
  onChange: (steps: string[]) => void;
}

const barTone = (r: number | null): string => (r === null ? 'bg-plum/20' : r >= 0.5 ? 'bg-fooder-mint' : r >= 0.2 ? 'bg-fooder-secondary' : 'bg-bubblegum');

export function FunnelView({ steps, current, events, onChange }: FunnelViewProps) {
  const [draft, setDraft] = useState(current.join(', '));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(current.join(', ')), [current]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseSteps(draft.replace(/\s+/g, ''));
    if (!parsed) {
      setError('2 à 8 étapes, noms en minuscules (chiffres et _), séparées par des virgules. Écran : screen_view:/swipe');
      return;
    }
    setError(null);
    onChange(parsed);
  };

  const first = steps[0]?.users ?? 0;
  const same = (a: string[]) => a.join(',') === current.join(',');

  return (
    <div>
      <div className='flex flex-wrap gap-2 mb-3' role='group' aria-label='Funnels prédéfinis'>
        {PRESETS.map(p => (
          <ChipButton key={p.label} active={same(p.steps)} onClick={() => onChange(p.steps)}>
            {p.label}
          </ChipButton>
        ))}
      </div>
      <form onSubmit={submit} className='flex flex-col sm:flex-row gap-2 mb-5'>
        <label htmlFor='funnel-steps' className='sr-only'>
          Étapes du funnel
        </label>
        <input
          id='funnel-steps'
          list='funnel-event-names'
          value={draft}
          onChange={e => setDraft(e.target.value)}
          spellCheck={false}
          className='flex-1 min-w-0 rounded-2xl border-[3px] border-plum bg-cream px-3 py-2 font-mono text-sm outline-none focus:bg-white focus:shadow-hard-violet'
        />
        <datalist id='funnel-event-names'>
          {events.map(e => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>
        <button type='submit' className='rounded-full border-[3px] border-plum bg-plum text-fooder-secondary font-bold px-4 py-2 shadow-[0_3px_0_#6C2BFF] active:translate-y-[3px] active:shadow-none'>
          Calculer
        </button>
      </form>
      {error && (
        <p role='alert' className='text-sm font-bold text-fooder-red -mt-3 mb-4'>
          {error}
        </p>
      )}

      {first === 0 ? (
        <Empty>Personne n’a encore fait la première étape sur cette période.</Empty>
      ) : (
        <ol className='space-y-1'>
          {steps.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              {i > 0 && (
                <div className='flex items-center gap-2 pl-3 py-1 text-xs font-bold text-plum/70'>
                  <ArrowDown className='w-3.5 h-3.5' strokeWidth={3} aria-hidden />
                  <span className={`px-2 py-0.5 rounded-full border-2 border-plum ${barTone(s.fromPrev)}`}>{formatPct(s.fromPrev)}</span>
                  <span>passent à l’étape suivante</span>
                  {s.dropped > 0 && <span className='text-plum/50'>· {formatNumber(s.dropped)} perdus</span>}
                  {s.medianS !== null && <span className='text-plum/50 hidden sm:inline'>· délai médian {formatDuration(s.medianS)}</span>}
                </div>
              )}
              <div className='flex items-center gap-3'>
                <span className='w-7 h-7 shrink-0 rounded-full bg-plum text-cream font-display text-sm flex items-center justify-center'>{i + 1}</span>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='font-bold text-sm truncate' title={s.name}>
                      {s.label}
                    </span>
                    <span className='text-xs font-bold text-plum/60 tabular-nums shrink-0'>
                      <span className='font-display text-base text-plum'>{formatNumber(s.users)}</span> · {formatPct(s.fromStart)}
                    </span>
                  </div>
                  <div className='mt-1 h-4 rounded-full border-2 border-plum bg-cream overflow-hidden'>
                    <div className={`h-full ${i === 0 ? 'bg-fooder-primary' : barTone(s.fromPrev)} border-r-2 border-plum transition-[width] duration-500`} style={{ width: `${Math.max(2, (s.fromStart ?? 0) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
