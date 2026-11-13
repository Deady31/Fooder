'use client';
import { RADIUS_STEPS, radiusLabel, type Radius } from '../../lib/geo/radius';

interface RadiusOptionsProps {
  value: Radius;
  onChange: (r: Radius) => void;
  /** Nombre de restos par palier (facultatif). */
  counts?: (r: Radius) => number;
  labelledBy: string;
}

/** Choix du rayon : 500 m, 1 km, 2 km, 5 km, 10 km, toute la métropole (groupe radio accessible). */
export function RadiusOptions({ value, onChange, counts, labelledBy }: RadiusOptionsProps) {
  return (
    <div role='radiogroup' aria-labelledby={labelledBy} className='grid grid-cols-3 gap-2'>
      {RADIUS_STEPS.map(r => {
        const active = r === value;
        const n = counts?.(r);
        return (
          <button
            key={String(r)}
            type='button'
            role='radio'
            aria-checked={active}
            onClick={() => onChange(r)}
            className={`min-h-[44px] rounded-2xl border-[3px] border-plum px-2 py-1.5 text-sm font-bold text-plum leading-tight transition-transform active:translate-y-0.5 ${
              r === null ? 'col-span-3' : ''
            } ${active ? 'bg-fooder-primary !text-white shadow-none' : 'bg-white shadow-hard-sm'}`}
          >
            {radiusLabel(r)}
            {n !== undefined && <span className='block text-[11px] font-semibold opacity-80'>{n} {n > 1 ? 'restos' : 'resto'}</span>}
          </button>
        );
      })}
    </div>
  );
}
