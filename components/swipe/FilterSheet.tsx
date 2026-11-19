'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { RadiusOptions } from '../geo/RadiusOptions';
import type { Radius } from '../../lib/geo/radius';
import type { Diet } from '../../data/mockRestaurants';
import { DIET_LABEL } from '../../lib/diets';
import { FILTER_DIETS } from '../../lib/filters';
import { defaultCuisineList, matchesCuisineQuery } from '../../lib/categories';

interface CatalogItem { label: string; count: number }
/** Catalogue complet des cuisines (toutes les fiches de la métropole), chargé une fois par session. */
let catalogCache: CatalogItem[] | null = null;

/** Cran maximal du curseur de budget : « Sans limite ». */
const BUDGET_MAX = 150;

export interface FilterValues {
  radius: Radius;
  /** null = sans limite */
  maxPrice: number | null;
  /** null = toutes */
  cuisine: string | null;
  /** Régimes exigés (ET logique) ; repris du profil la première fois. */
  diets: Diet[];
}

interface FilterSheetProps {
  isOpen: boolean;
  values: FilterValues;
  cuisines: string[];
  onApply: (values: FilterValues) => void;
  onClose: () => void;
}

/** Filtres non destructifs : distance, fermés, budget, cuisine. Rien n'est appliqué avant « Appliquer ». */
export function FilterSheet({ isOpen, values, cuisines, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<FilterValues>(values);
  useEffect(() => {
    if (isOpen) setDraft(values);
    // Brouillon réinitialisé à chaque ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const budget = draft.maxPrice ?? BUDGET_MAX;

  const [catalog, setCatalog] = useState<CatalogItem[] | null>(catalogCache);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    if (catalogCache) return;
    let alive = true;
    fetch('/api/cuisines')
      .then(r => r.json())
      .then((j: { success?: boolean; data?: CatalogItem[] }) => {
        if (!j.success || !Array.isArray(j.data)) return;
        catalogCache = j.data;
        if (alive) setCatalog(j.data);
      })
      .catch(() => undefined); // hors ligne : on garde la liste de la pile
    return () => { alive = false; };
  }, [isOpen]);

  const searching = query.trim() !== '';
  const { options, matchCount } = useMemo(() => {
    let list: string[];
    if (!catalog) list = cuisines.filter(c => matchesCuisineQuery(c, query));
    else if (searching) list = catalog.filter(c => matchesCuisineQuery(c.label, query)).map(c => c.label);
    else list = defaultCuisineList(catalog, draft.cuisine);
    return { options: draft.cuisine && !list.includes(draft.cuisine) ? [draft.cuisine, ...list] : list, matchCount: list.length };
  }, [catalog, cuisines, query, searching, draft.cuisine]);
  const hiddenCount = catalog && !searching ? Math.max(0, catalog.length - options.length) : 0;

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

        <div className='space-y-3'>
          <p id='filtres-regime' className='text-sm font-bold text-plum-muted'>Régime</p>
          <div role='group' aria-labelledby='filtres-regime' className='flex flex-wrap gap-2.5'>
            {FILTER_DIETS.map(d => {
              const active = draft.diets.includes(d);
              return (
                <button
                  key={d}
                  type='button'
                  aria-pressed={active}
                  onClick={() => setDraft(v => ({ ...v, diets: active ? v.diets.filter(x => x !== d) : [...v.diets, d] }))}
                  className={`chip min-h-[44px] text-xs px-4 py-2 transition-all active:translate-y-0.5 ${active ? 'bg-fooder-primary text-white' : 'bg-white text-plum'}`}
                >
                  {active && <span aria-hidden='true'>✓</span>}
                  {DIET_LABEL[d]}
                </button>
              );
            })}
          </div>
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
          <div className='flex items-center gap-2 rounded-full border-[3px] border-plum bg-white pl-4 pr-1 min-h-[48px] focus-within:shadow-hard'>
            <Search className='w-4 h-4 text-plum-muted shrink-0' strokeWidth={3} aria-hidden='true' />
            <label htmlFor='filtres-recherche' className='sr-only'>Chercher une cuisine</label>
            <input
              id='filtres-recherche'
              type='search'
              value={query}
              onChange={e => setQuery(e.target.value.slice(0, 40))}
              placeholder='Pizza, sushi, poulet…'
              autoComplete='off'
              enterKeyHint='search'
              className='flex-1 min-w-0 [&::-webkit-search-cancel-button]:appearance-none bg-transparent text-base font-medium text-plum placeholder:text-plum-muted outline-none'
            />
            {query && (
              <button type='button' onClick={() => setQuery('')} aria-label='Effacer la recherche' className='w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-plum'>
                <X className='w-4 h-4' strokeWidth={3} />
              </button>
            )}
          </div>
          <div role='radiogroup' aria-labelledby='filtres-cuisine' className='flex flex-wrap gap-2.5'>
            {[...(searching ? [] : [null]), ...options].map(c => {
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
          {searching && matchCount === 0 && (
            <p role='status' className='text-sm font-medium text-plum-muted'>Aucune cuisine ne correspond à « {query.trim()} ».</p>
          )}
          {hiddenCount > 0 && <p className='text-xs font-medium text-plum-muted'>Tape un nom pour voir les {hiddenCount} autres cuisines.</p>}
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
