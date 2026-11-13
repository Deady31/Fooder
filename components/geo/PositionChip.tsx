'use client';
import { MapPin, Loader2 } from 'lucide-react';
import type { Address } from '../../lib/geo/address';
import { accuracyLevel, formatAccuracy, type AccuracyLevel, type PositionState } from '../../lib/geo/position';

const TINT: Record<AccuracyLevel, string> = {
  good: 'bg-fooder-mint',
  fair: 'bg-fooder-secondary',
  poor: 'bg-fooder-orange',
  none: 'bg-white',
};

const LEVEL_TEXT: Record<AccuracyLevel, string> = {
  good: 'précise',
  fair: 'approximative',
  poor: 'peu précise',
  none: 'par défaut',
};

/** Libellé de la position : adresse saisie, adresse trouvée, ou repli honnête. */
export function positionLabel(position: PositionState, address: Address | null): string {
  if (position.source === 'manual') return position.label ?? 'Adresse choisie';
  if (position.source === 'default') return position.status === 'asking' ? 'Localisation…' : 'Centre de Toulouse';
  return address?.short ?? (position.source === 'last' ? 'Dernière position' : 'Ma position');
}

interface PositionChipProps {
  position: PositionState;
  address: Address | null;
  onOpen: () => void;
}

/** Puce d'en-tête « 📍 12 rue d'Alsace-Lorraine · ±15 m », couleur selon la fiabilité. */
export function PositionChip({ position, address, onOpen }: PositionChipProps) {
  const level = accuracyLevel(position.accuracy, position.source);
  const label = positionLabel(position, address);
  const showAccuracy = (position.source === 'gps' || position.source === 'last') && position.accuracy !== null;
  const accuracy = showAccuracy ? formatAccuracy(position.accuracy as number) : null;
  const asking = position.status === 'asking';

  return (
    <button
      type='button'
      onClick={onOpen}
      aria-label={`Ta position : ${label}${accuracy ? `, ${accuracy}` : ''}, ${LEVEL_TEXT[level]}. Modifier`}
      className={`chip min-h-[44px] min-w-0 flex-1 justify-start text-plum active:translate-y-0.5 transition-transform ${TINT[level]}`}
    >
      {asking ? (
        <Loader2 className='w-4 h-4 shrink-0 animate-spin' strokeWidth={2.5} aria-hidden='true' />
      ) : (
        <MapPin className='w-4 h-4 shrink-0' strokeWidth={2.5} aria-hidden='true' />
      )}
      <span className='truncate'>{label}</span>
      {accuracy && <span className='shrink-0 tabular-nums font-extrabold'>· {accuracy}</span>}
    </button>
  );
}
