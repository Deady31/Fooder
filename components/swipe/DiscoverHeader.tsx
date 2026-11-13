'use client';
import { ChevronDown, CircleDot, SlidersHorizontal } from 'lucide-react';
import type { Diet } from '../../data/mockRestaurants';
import { Logo } from '../ui/Logo';
import { NotificationBell } from '../notifications/NotificationBell';
import { PositionChip } from '../geo/PositionChip';
import { PositionBanner } from '../geo/PositionBanner';
import { DIET_LABEL } from '../../lib/diets';
import { FILTER_DIETS } from '../../lib/filters';
import type { Address } from '../../lib/geo/address';
import type { PositionState } from '../../lib/geo/position';
import { radiusLabel, radiusShortLabel, withinLabel, type Radius } from '../../lib/geo/radius';

interface DiscoverHeaderProps {
  moodLabel: string;
  onFilters: () => void;
  onMood: () => void;
  position: PositionState;
  address: Address | null;
  onPosition: () => void;
  radius: Radius;
  onRadius: () => void;
}

/** Barre du haut + ligne « position · distance » + bandeau de refus. */
export function DiscoverHeader({ moodLabel, onFilters, onMood, position, address, onPosition, radius, onRadius }: DiscoverHeaderProps) {
  return (
    <>
      <header className='shrink-0 flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 backdrop-blur-md border-b-[3px] border-plum z-20 bg-cream/90'>
        <h1 className='sr-only'>Découvrir</h1>
        <button
          type='button'
          onClick={onFilters}
          aria-label='Filtres'
          className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
        >
          <SlidersHorizontal className='w-5 h-5 text-plum' strokeWidth={2.5} />
        </button>
        <div className='flex flex-col items-center gap-1.5 min-w-0'>
          <Logo className='w-[clamp(130px,40vw,176px)]' />
          <button type='button' onClick={onMood} className='chip bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'>
            <span className='truncate max-w-[110px]'>{moodLabel}</span>
            <ChevronDown className='w-3 h-3' strokeWidth={3} />
          </button>
        </div>
        <NotificationBell />
      </header>

      <div className='shrink-0 flex items-center gap-2 px-4 pt-2'>
        <PositionChip position={position} address={address} onOpen={onPosition} />
        <button
          type='button'
          onClick={onRadius}
          aria-label={`Distance : ${radiusLabel(radius)}. Modifier`}
          className='chip shrink-0 min-h-[44px] bg-white text-plum active:translate-y-0.5 transition-transform'
        >
          <CircleDot className='w-4 h-4' strokeWidth={2.5} aria-hidden='true' />
          {radiusShortLabel(radius)}
          <ChevronDown className='w-3 h-3' strokeWidth={3} aria-hidden='true' />
        </button>
      </div>
      <PositionBanner position={position} onHelp={onPosition} />
    </>
  );
}

interface FilterChipsProps {
  openNow: boolean;
  diets: Diet[];
  onOpenNow: () => void;
  onDiet: (d: Diet) => void;
  count: number;
  radius: Radius;
  /** Proposé quand il reste trop peu de cartes dans le rayon. */
  widenTo: Radius | undefined;
  onWiden: (r: Radius) => void;
  showCount: boolean;
}

/** Puces « Ouvert maintenant » + régimes, et compteur de restos restants dans le rayon. */
export function FilterChips({ openNow, diets, onOpenNow, onDiet, count, radius, widenTo, onWiden, showCount }: FilterChipsProps) {
  return (
    <div className='shrink-0 px-4 pt-2 relative z-10'>
      <div className='flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -my-1'>
        <button
          type='button'
          onClick={onOpenNow}
          aria-pressed={openNow}
          className={`chip shrink-0 min-h-[44px] text-plum active:translate-y-0.5 transition-transform ${openNow ? 'bg-fooder-mint' : 'bg-white'}`}
        >
          <span className={`w-2 h-2 rounded-full border-[1.5px] border-plum ${openNow ? 'bg-white' : 'bg-fooder-mint'}`} />
          Ouvert maintenant
        </button>
        {FILTER_DIETS.map(d => {
          const active = diets.includes(d);
          return (
            <button
              key={d}
              type='button'
              onClick={() => onDiet(d)}
              aria-pressed={active}
              className={`chip shrink-0 min-h-[44px] min-w-[44px] justify-center text-plum active:translate-y-0.5 transition-transform ${active ? 'bg-fooder-primary !text-white shadow-hard font-extrabold' : 'bg-white'}`}
            >
              {active && <span aria-hidden='true'>✓</span>}
              {DIET_LABEL[d]}
            </button>
          );
        })}
      </div>
      {showCount && (
        <p className='mt-1 mb-1 flex items-center justify-center gap-1.5 text-xs font-bold text-plum-muted' aria-live='polite'>
          <span>{count} {count > 1 ? 'restos' : 'resto'} {withinLabel(radius)}</span>
          {count > 0 && count <= 3 && widenTo !== undefined && (
            <button type='button' onClick={() => onWiden(widenTo)} className='underline underline-offset-2 text-plum min-h-[28px]'>
              Élargir à {widenTo === null ? 'la métropole' : radiusLabel(widenTo)}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
