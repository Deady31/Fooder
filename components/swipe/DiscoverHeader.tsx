'use client';
import { ChevronDown, CircleDot, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { NotificationBell } from '../notifications/NotificationBell';
import { PositionChip } from '../geo/PositionChip';
import { PositionBanner } from '../geo/PositionBanner';
import type { Address } from '../../lib/geo/address';
import type { PositionState } from '../../lib/geo/position';
import { radiusLabel, radiusShortLabel, type Radius } from '../../lib/geo/radius';

interface DiscoverHeaderProps {
  moodLabel: string;
  onMood: () => void;
}

/** Barre du haut (filtres, logo + envie, notifications) : le logo s'efface quand l'écran est bas (la carte passe avant). */
export function DiscoverHeader({ moodLabel, onMood }: DiscoverHeaderProps) {
  return (
      /* Trois zones de largeur égale : le logo est centré quel que soit le nombre de boutons de chaque côté.
         Pas de trait sous l'en-tête : un fondu crème (::after) le relie à la suite. */
      <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 pb-2.5 [@media(max-height:700px)]:py-1.5 z-20 bg-cream relative after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-gradient-to-b after:from-cream after:to-transparent after:pointer-events-none">
        <h1 className='sr-only'>Découvrir</h1>
        <div className='flex items-center gap-2 justify-self-start'>
          <button
            type='button'
            data-tour='mood'
            onClick={onMood}
            aria-label={`Mon envie : ${moodLabel}. Changer`}
            title={moodLabel}
            className='relative w-11 h-11 bg-fooder-secondary border-2 border-plum rounded-full flex items-center justify-center shadow-hard-sm active:translate-y-0.5 active:shadow-none transition-all'
          >
            <Sparkles className='w-5 h-5 text-plum' strokeWidth={2.5} />
            {moodLabel !== 'Surprends-moi' && <span aria-hidden='true' className='absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-fooder-primary border-2 border-plum' />}
          </button>
        </div>
        <Logo className='w-[clamp(96px,30vw,136px)] min-w-0 justify-self-center [@media(max-height:560px)]:invisible' />
        <div className='justify-self-end'>
          <NotificationBell />
        </div>
      </header>
  );
}

interface PositionRowProps {
  position: PositionState;
  address: Address | null;
  onPosition: () => void;
  radius: Radius;
  onRadius: () => void;
}

/** Ligne « position · distance » + bandeau de refus (partie secondaire : elle défile si l'écran manque de hauteur). */
export function PositionRow({ position, address, onPosition, radius, onRadius }: PositionRowProps) {
  return (
    <>
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
      <div className='[@media(max-height:1100px)]:hidden'>
        <PositionBanner position={position} onHelp={onPosition} />
      </div>
    </>
  );
}

interface FilterChipsProps {
  /** Ouvre la feuille de filtres (régimes, budget, cuisine, fermés). */
  onFilters: () => void;
  /** Nombre de filtres actifs dans la feuille (hors distance, qui a sa puce). */
  activeCount: number;
  count: number;
  /** Proposé quand il reste trop peu de cartes dans le rayon. */
  widenTo: Radius | undefined;
  onWiden: (r: Radius) => void;
  showCount: boolean;
}

/** Une seule ligne : bouton « Filtres (n) », puis compteur de restos restants dans le rayon. */
export function FilterChips({ onFilters, activeCount, count, widenTo, onWiden, showCount }: FilterChipsProps) {
  return (
    <div className='shrink-0 px-4 pt-2 relative z-10'>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={onFilters}
          aria-label={activeCount > 0 ? `Filtres, ${activeCount} actif${activeCount > 1 ? 's' : ''}` : 'Filtres'}
          className={`chip shrink-0 min-h-[44px] text-plum active:translate-y-0.5 transition-transform ${activeCount > 0 ? 'bg-fooder-primary !text-white' : 'bg-white'}`}
        >
          <SlidersHorizontal className='w-4 h-4' strokeWidth={2.5} aria-hidden='true' />
          Filtres{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {showCount && (
          <p className='min-w-0 flex-1 text-right text-[11px] min-[360px]:text-xs font-bold leading-tight text-plum-muted' aria-live='polite'>
            {count} {count > 1 ? 'restos' : 'resto'}
          </p>
        )}
      </div>
      {showCount && count > 0 && count <= 3 && widenTo !== undefined && (
        <p className='mt-1 text-center text-xs font-bold text-plum-muted'>
          <button type='button' onClick={() => onWiden(widenTo)} className='underline underline-offset-2 text-plum min-h-[28px]'>
            Élargir à {widenTo === null ? 'la métropole' : radiusLabel(widenTo)}
          </button>
        </p>
      )}
    </div>
  );
}
