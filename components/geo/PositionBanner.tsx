'use client';
import { ChevronRight } from 'lucide-react';
import type { PositionState } from '../../lib/geo/position';

/** Bandeau explicite quand la position n'est pas partagée (refus) : d'où partent les résultats ; touche = comment l'autoriser. */
export function PositionBanner({ position, onHelp }: { position: PositionState; onHelp: () => void }) {
  if (position.status !== 'denied' || position.source === 'manual') return null;
  const from = position.source === 'last' ? 'ta dernière position connue' : 'le centre de Toulouse';
  return (
    <div role='status' className='shrink-0 px-4 pt-2'>
      <button
        type='button'
        onClick={onHelp}
        className='w-full min-h-[44px] flex items-center gap-2 rounded-2xl border-[3px] border-plum bg-white px-3 py-1 text-left text-[11px] font-bold leading-tight text-plum active:translate-y-0.5 transition-transform'
      >
        <span className='min-w-0 flex-1'>
          Position non partagée : résultats depuis {from}. <span className='underline underline-offset-2'>Comment l’autoriser</span>
        </span>
        <ChevronRight className='w-4 h-4 shrink-0' strokeWidth={3} aria-hidden='true' />
      </button>
    </div>
  );
}
