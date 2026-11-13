'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { RadiusOptions } from '../geo/RadiusOptions';
import type { Radius } from '../../lib/geo/radius';

/** Cran maximal du curseur de budget : « Sans limite ». */
const BUDGET_MAX = 150;

export interface FilterValues {
  radius: Radius;
  /** null = sans limite */
  maxPrice: number | null;
  /** null = toutes */
  cuisine: string | null;
}

interface FilterSheetProps {
  isOpen: boolean;
  values: FilterValues;
  cuisines: string[];
  onApply: (values: FilterValues) => void;
  onClose: () => void;
}

/** Filtres non destructifs : distance, budget, cuisine. Rien n'est appliqué avant « Appliquer ». */
export function FilterSheet({ isOpen, values, cuisines, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<FilterValues>(values);
  useEffect(() => {
    if (isOpen) setDraft(values);
    // Brouillon réinitialisé à chaque ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const budget = draft.maxPrice ?? BUDGET_MAX;
  const options = draft.cuisine && !cuisines.includes(draft.cuisine) ? [draft.cuisine, ...cuisines] : cuisines;

  return (
    <Sheet open={isOpen} onClose={onClose} labelledBy='filtres-titre' className='bg-cream rounded-[32px] panel'>
      <div className='p-[clamp(16px,5.5vw,28px)] pt-2 space-y-[clamp(14px,5vw,24px)]'>
        <div className='flex justify-between items-center'>
          <h2 id='filtres-titre' className='text-[clamp(24px,8vw,32px)] text-plum'>Filtres</h2>
          <button
            type='button'
            onClick={onClose}
            aria-label='Fermer'
            className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
          >
            <X className='w-5 h-5' strokeWidth={3} />
          </button>
        </div>

        <div className='space-y-3'>
          <p id='filtres-distance' className='text-sm font-bold text-plum-muted'>Distance</p>
          <RadiusOptions value={draft.radius} labelledBy='filtres-distance' onChange={radius => setDraft(d => ({ ...d, radius }))} />
        </div>

        <div className='space-y-4'>
          <div className='flex justify-between items-end'>
            <label htmlFor='filtres-budget' className='text-sm font-bold text-plum-muted'>Budget max</label>
            <span className='text-3xl font-display text-fooder-primary'>{budget >= BUDGET_MAX ? 'Sans limite' : `${budget}€`}</span>
          </div>
          <input
            id='filtres-budget'
            type='range' min='10' max={BUDGET_MAX} step='5' value={budget}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              setDraft(d => ({ ...d, maxPrice: v >= BUDGET_MAX ? null : v }));
            }}
            aria-valuetext={budget >= BUDGET_MAX ? 'Sans limite' : `${budget} euros`}
            className='w-full h-3 bg-white border-2 border-plum rounded-full appearance-none cursor-pointer accent-fooder-primary'
          />
          <p className='text-xs font-medium text-plum-muted'>Les restos dont le prix est inconnu restent affichés.</p>
        </div>

        <div className='space-y-3'>
          <p id='filtres-cuisine' className='text-sm font-bold text-plum-muted'>Envie de cuisine</p>
          <div role='radiogroup' aria-labelledby='filtres-cuisine' className='flex flex-wrap gap-2.5'>
            {[null, ...options].map(c => {
              const active = draft.cuisine === c;
              return (
                <button
                  key={c ?? 'toutes'}
                  type='button'
                  role='radio'
                  aria-checked={active}
                  onClick={() => setDraft(d => ({ ...d, cuisine: c }))}
                  className={`chip min-h-[44px] text-xs px-4 py-2 transition-all active:translate-y-0.5 ${active ? 'bg-fooder-primary text-white' : 'bg-white text-plum'}`}
                >
                  {c ?? 'Toutes'}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type='button'
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className='w-full duo-button bg-fooder-secondary text-plum py-4 text-lg'
        >
          Appliquer
        </button>
      </div>
    </Sheet>
  );
}
