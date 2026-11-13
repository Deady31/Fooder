'use client';
import { useEffect, useRef } from 'react';
import { Crosshair, LocateFixed, MapPin, RefreshCw, Search, X } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import type { Address } from '../../lib/geo/address';
import { useAddressSearch, type AddressStatus } from '../../lib/geo/useAddress';
import { formatAccuracy, type Coords, type PositionState } from '../../lib/geo/position';
import { positionLabel } from './PositionChip';

interface PositionSheetProps {
  open: boolean;
  onClose: () => void;
  position: PositionState;
  address: Address | null;
  addressStatus: AddressStatus;
  onLocate: () => void;
  onManual: (coords: Coords, label: string) => void;
}

function sourceLine(p: PositionState): string {
  if (p.source === 'manual') return 'Adresse saisie à la main. Les distances partent de là.';
  if (p.source === 'default') return 'Position par défaut : centre de Toulouse (place du Capitole). Les distances partent de là, pas de toi.';
  const acc = p.accuracy !== null ? `précision ${formatAccuracy(p.accuracy)}` : 'précision inconnue';
  if (p.source === 'last') {
    const min = p.updatedAt ? Math.max(1, Math.round((Date.now() - p.updatedAt) / 60_000)) : null;
    const age = min === null ? '' : min < 60 ? ` (il y a ${min} min)` : ` (il y a ${Math.round(min / 60)} h)`;
    return `Dernière position connue${age}, ${acc}.`;
  }
  return `Position GPS, ${acc}.`;
}

function DeniedHelp() {
  return (
    <div className='rounded-2xl border-[3px] border-dashed border-plum bg-white p-3 text-sm text-plum space-y-2'>
      <p className='font-bold'>La localisation est bloquée pour Fooder.</p>
      <p><span className='font-bold'>iPhone :</span> Réglages › Confidentialité et sécurité › Service de localisation › Safari (ou ton navigateur) › « Lorsque l’app est active ». Recharge ensuite la page.</p>
      <p><span className='font-bold'>Android :</span> touche le cadenas à gauche de l’adresse du site › Autorisations › Position › Autoriser, puis « Actualiser ».</p>
    </div>
  );
}

/** Fenêtre « Ta position » : adresse et précision, actualiser, GPS, saisie d'adresse avec autocomplétion, aide si refus. */
export function PositionSheet({ open, onClose, position, address, addressStatus, onLocate, onManual }: PositionSheetProps) {
  const search = useAddressSearch(position.coords);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setQuery } = search;

  useEffect(() => {
    if (!open) setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = position.source === 'gps' || position.source === 'last' ? address?.label ?? positionLabel(position, address) : positionLabel(position, address);
  const isManual = position.source === 'manual';

  return (
    <Sheet open={open} onClose={onClose} labelledBy='position-titre' className='bg-cream rounded-[28px] panel'>
      <div className='p-[clamp(16px,5vw,24px)] pt-2 space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <h2 id='position-titre' className='text-[clamp(24px,7.5vw,30px)] leading-none text-plum'>Ta position</h2>
          <button type='button' onClick={onClose} aria-label='Fermer' className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'>
            <X className='w-5 h-5 text-plum' strokeWidth={3} />
          </button>
        </div>

        <div className='rounded-2xl border-[3px] border-plum bg-white p-3 flex gap-3'>
          <MapPin className='w-5 h-5 shrink-0 text-plum mt-0.5' strokeWidth={2.5} aria-hidden='true' />
          <div className='min-w-0 space-y-1'>
            <p className='font-bold text-plum leading-snug select-text break-words'>
              {title}
              {(position.source === 'gps' || position.source === 'last') && addressStatus === 'loading' && !address && (
                <span className='font-medium text-plum-muted'> · recherche de l’adresse…</span>
              )}
            </p>
            <p className='text-xs font-medium text-plum-muted leading-snug'>{sourceLine(position)}</p>
            {position.status === 'asking' && <p className='text-xs font-bold text-plum'>Recherche de ta position…</p>}
            {(position.status === 'timeout' || position.status === 'unavailable') && position.source !== 'gps' && (
              <p className='text-xs font-bold text-plum'>Pas de signal GPS pour le moment. Essaie près d’une fenêtre, ou saisis ton adresse.</p>
            )}
          </div>
        </div>

        {position.status === 'denied' && !isManual && <DeniedHelp />}

        <button
          type='button'
          onClick={onLocate}
          disabled={position.status === 'asking'}
          className='w-full duo-button bg-fooder-secondary text-plum py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60'
        >
          {isManual ? <LocateFixed className='w-5 h-5' strokeWidth={2.5} /> : <RefreshCw className='w-5 h-5' strokeWidth={2.5} />}
          {isManual ? 'Utiliser ma position GPS' : 'Actualiser'}
        </button>

        <div className='space-y-2'>
          <label htmlFor='position-adresse' className='text-sm font-bold text-plum flex items-center gap-1.5'>
            <Search className='w-4 h-4' strokeWidth={2.5} aria-hidden='true' /> Saisir une adresse
          </label>
          <input
            ref={inputRef}
            id='position-adresse'
            type='text'
            inputMode='search'
            autoComplete='street-address'
            placeholder='Ex. 12 rue d’Alsace-Lorraine'
            value={search.query}
            onChange={e => search.setQuery(e.target.value)}
            className='w-full min-h-[48px] rounded-2xl border-[3px] border-plum bg-white px-3 text-base text-plum placeholder:text-plum-muted select-text'
            aria-describedby='position-adresse-aide'
          />
          <p id='position-adresse-aide' className='sr-only' aria-live='polite'>
            {search.status === 'loading' ? 'Recherche…' : search.status === 'ok' ? `${search.results.length} adresses proposées` : search.status === 'failed' ? 'Aucune adresse trouvée' : ''}
          </p>
          {search.status === 'failed' && <p className='text-xs font-bold text-plum'>Aucune adresse trouvée (ou service injoignable). Vérifie l’orthographe.</p>}
          {search.results.length > 0 && (
            <ul className='rounded-2xl border-[3px] border-plum bg-white divide-y-2 divide-dashed divide-plum/15 overflow-hidden'>
              {search.results.map(a => (
                <li key={a.id}>
                  <button
                    type='button'
                    onClick={() => {
                      onManual(a.coords, a.short);
                      onClose();
                    }}
                    className='w-full min-h-[48px] px-3 py-2 text-left text-sm text-plum flex items-center gap-2 hover:bg-fooder-secondary/40 focus-visible:bg-fooder-secondary/40'
                  >
                    <Crosshair className='w-4 h-4 shrink-0' strokeWidth={2.5} aria-hidden='true' />
                    <span className='min-w-0'>
                      <span className='block font-bold truncate'>{a.short}</span>
                      <span className='block text-xs text-plum-muted'>{[a.postcode, a.city].filter(Boolean).join(' ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className='text-[11px] font-medium text-plum-muted leading-snug'>
          Adresses : Base Adresse Nationale (service public, licence ouverte). Seules des coordonnées arrondies lui sont envoyées.
        </p>
      </div>
    </Sheet>
  );
}
