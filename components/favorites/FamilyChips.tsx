'use client';
import { Sticker } from '../ui/Sticker';
import type { FamilyCount, FamilyId } from '../../lib/favoriteTypes';

interface FamilyChipsProps {
  counts: readonly FamilyCount[];
  total: number;
  /** Famille choisie ; null : « Tout ». */
  value: FamilyId | null;
  onChange: (next: FamilyId | null) => void;
  className?: string;
}

/**
 * Filtre par type de resto, partagé par la liste et la carte des favoris. Une seule famille à la fois ;
 * toucher la famille choisie (ou « Tout ») retire le filtre. Rien ne s'affiche s'il n'y a qu'un seul type à choisir.
 */
export function FamilyChips({ counts, total, value, onChange, className = '' }: FamilyChipsProps) {
  if (counts.length < 2) return null;
  const base = 'chip shrink-0 min-h-[40px] snap-start transition-colors active:translate-y-0.5';
  return (
    <div className={`relative ${className}`}>
      <div role='group' aria-label='Type de restaurant' className='flex gap-2 overflow-x-auto snap-x px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        <button type='button' aria-pressed={value === null} onClick={() => onChange(null)} className={`${base} ${value === null ? 'bg-fooder-secondary text-plum' : 'bg-white text-plum'}`}>
          Tout ({total})
        </button>
        {counts.map(({ family, count }) => {
          const on = value === family.id;
          return (
            <button
              key={family.id}
              type='button'
              aria-pressed={on}
              onClick={() => onChange(on ? null : family.id)}
              className={`${base} whitespace-nowrap ${on ? 'bg-fooder-secondary text-plum' : 'bg-white text-plum'}`}
            >
              <Sticker name={family.sticker} size={20} />
              {family.label} ({count})
            </button>
          );
        })}
      </div>
      {/* Indice de défilement : les puces dépassent de l'écran. */}
      <div aria-hidden='true' className='pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream to-transparent' />
    </div>
  );
}
