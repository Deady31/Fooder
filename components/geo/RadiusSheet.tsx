'use client';
import { X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import type { Radius } from '../../lib/geo/radius';
import { RadiusOptions } from './RadiusOptions';

interface RadiusSheetProps {
  open: boolean;
  onClose: () => void;
  value: Radius;
  onChange: (r: Radius) => void;
  counts?: (r: Radius) => number;
}

/** Choix rapide de la distance depuis l'en-tête. */
export function RadiusSheet({ open, onClose, value, onChange, counts }: RadiusSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy='rayon-titre' className='bg-cream rounded-[28px] panel'>
      <div className='p-[clamp(16px,5vw,24px)] pt-2 space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 id='rayon-titre' className='text-[clamp(24px,7.5vw,30px)] leading-none text-plum'>Distance</h2>
            <p className='text-xs font-semibold text-plum-muted mt-1'>À vol d’oiseau depuis ta position.</p>
          </div>
          <button type='button' onClick={onClose} aria-label='Fermer' className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'>
            <X className='w-5 h-5 text-plum' strokeWidth={3} />
          </button>
        </div>
        <RadiusOptions
          value={value}
          counts={counts}
          labelledBy='rayon-titre'
          onChange={r => {
            onChange(r);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}
