'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { getUsageEnabled, setUsageEnabled } from '../../lib/analytics';

/** Réglage « Aider à améliorer Fooder (mesures anonymes) » : activé par défaut, désactivable à tout moment. */
export function UsageToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => setOn(getUsageEnabled()), []);

  const toggle = () => {
    const next = !on;
    setUsageEnabled(next);
    setOn(next);
  };

  return (
    <section className='bg-white rounded-[28px] panel p-4 space-y-2'>
      <div className='flex items-center gap-3'>
        <BarChart3 className='w-5 h-5 text-plum shrink-0' strokeWidth={2.5} />
        <div className='min-w-0 flex-1'>
          <p id='usage-label' className='text-sm font-bold text-plum'>Aider à améliorer Fooder</p>
          <p className='text-[11px] font-semibold text-plum/60'>Mesures anonymes d’usage</p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on}
          aria-labelledby='usage-label'
          onClick={toggle}
          className={`relative w-14 h-8 shrink-0 rounded-full border-[3px] border-plum transition-colors ${on ? 'bg-fooder-mint' : 'bg-white'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-plum transition-transform ${on ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>
      <p className='text-[11px] font-medium text-slate-600 leading-snug'>
        On compte des actions (likes, passes, ajouts d’amis…) sans nom, sans e-mail ni position, pour savoir ce qui sert. Conservé 13 mois.{' '}
        <Link href='/legal/privacy' className='underline'>Détails</Link>
      </p>
    </section>
  );
}
