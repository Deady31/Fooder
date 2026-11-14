'use client';
import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, RotateCcw, Search } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { FeedFilters, FeedScope, RestaurantOption, SCOPES, filterOptions } from './feedFilters';
import { MAX_QUERY } from './reviewSearch';

interface FeedFilterBarProps {
  filters: FeedFilters;
  onChange: (next: FeedFilters) => void;
  /** Restaurants qui ont des posts (hors exemples). */
  options: RestaurantOption[];
  /** Nombre d'avis affichés (null : aucun filtre ni recherche, pas de compteur). */
  count: number | null;
  onReset: () => void;
}

const plural = (n: number): string => `${n} avis`;

/** Barre « Tous · Amis · Moi », sélecteur de restaurant, compteur et bouton Réinitialiser. */
export function FeedFilterBar({ filters, onChange, options, count, onReset }: FeedFilterBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const titleId = useId();
  const searchId = useId();
  const current = options.find(o => o.id === filters.resto);
  const restoLabel = filters.resto ? (current?.name ?? 'Ce resto') : 'Tous les restos';
  const shown = useMemo(() => filterOptions(options, search), [options, search]);

  const close = () => {
    setPickerOpen(false);
    setSearch('');
  };
  const choose = (resto: string | null) => {
    onChange({ ...filters, resto });
    close();
  };

  return (
    <div className='space-y-2'>
      <div role='group' aria-label='Qui a posté' className='grid grid-cols-3 gap-1 bg-white p-1 rounded-full border-[3px] border-plum'>
        {SCOPES.map(s => (
          <button
            key={s.id}
            type='button'
            aria-pressed={filters.scope === s.id}
            onClick={() => onChange({ ...filters, scope: s.id as FeedScope })}
            className={`min-h-[44px] rounded-full text-sm font-bold transition-colors ${filters.scope === s.id ? 'bg-bubblegum text-plum' : 'text-plum-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={() => setPickerOpen(true)}
          aria-haspopup='dialog'
          className={`flex-1 min-w-0 min-h-[44px] flex items-center justify-between gap-2 rounded-full border-[3px] border-plum px-4 text-sm font-bold text-plum ${filters.resto ? 'bg-lemon' : 'bg-white'}`}
        >
          <span className='truncate'>{restoLabel}</span>
          <ChevronDown className='w-4 h-4 shrink-0' strokeWidth={3} aria-hidden='true' />
        </button>
        {count !== null && (
          <button type='button' onClick={onReset} className='min-h-[44px] shrink-0 inline-flex items-center gap-1.5 rounded-full border-[3px] border-plum bg-white px-3 text-xs font-bold text-plum active:translate-y-0.5'>
            <RotateCcw className='w-3.5 h-3.5' strokeWidth={3} aria-hidden='true' />
            Réinitialiser
          </button>
        )}
      </div>

      {count !== null && (
        <p role='status' aria-live='polite' className='text-xs font-bold text-plum-muted px-1'>
          {plural(count)}
        </p>
      )}

      <Sheet open={pickerOpen} onClose={close} labelledBy={titleId} className='bg-cream rounded-[32px] panel'>
        <div className='p-4 space-y-3'>
          <h2 id={titleId} className='text-xl text-plum'>Choisir un resto</h2>
          <div className='flex items-center gap-2 rounded-full border-[3px] border-plum bg-white pl-4 min-h-[48px] focus-within:shadow-hard'>
            <Search className='w-4 h-4 text-plum-muted shrink-0' strokeWidth={3} aria-hidden='true' />
            <label htmlFor={searchId} className='sr-only'>Chercher un resto</label>
            <input
              id={searchId}
              type='search'
              value={search}
              onChange={e => setSearch(e.target.value.slice(0, MAX_QUERY))}
              placeholder='Chercher un resto'
              autoComplete='off'
              className='flex-1 min-w-0 bg-transparent text-base font-medium text-plum placeholder:text-plum-muted outline-none'
            />
          </div>
          <ul className='max-h-[50vh] overflow-y-auto space-y-1.5 pb-2'>
            <li>
              <button type='button' onClick={() => choose(null)} aria-pressed={filters.resto === null}
                className='w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl border-2 border-plum bg-white px-3 text-left text-sm font-bold text-plum'>
                Tous les restos
                {filters.resto === null && <Check className='w-4 h-4' strokeWidth={3} aria-hidden='true' />}
              </button>
            </li>
            {shown.map(o => (
              <li key={o.id}>
                <button type='button' onClick={() => choose(o.id)} aria-pressed={filters.resto === o.id}
                  className='w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl border-2 border-plum bg-white px-3 py-1.5 text-left'>
                  <span className='min-w-0'>
                    <span className='block text-sm font-bold text-plum truncate'>{o.name}</span>
                    <span className='block text-[11px] font-semibold text-plum-muted truncate'>{o.cuisine} · {plural(o.count)}</span>
                  </span>
                  {filters.resto === o.id && <Check className='w-4 h-4 shrink-0' strokeWidth={3} aria-hidden='true' />}
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className='text-sm font-medium text-plum-muted px-1 py-2'>
                {options.length === 0 ? 'Aucun resto n’a encore d’avis.' : 'Aucun resto ne correspond.'}
              </li>
            )}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
