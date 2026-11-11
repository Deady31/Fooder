'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { stickerFor } from '../../lib/stickers';
import { readJson, randomId } from '../../lib/store';
import { getMe } from '../../lib/identity';
import { quartierFor } from '../../lib/quartiers';
import { Defi, MAX_HINT } from '../../lib/social/defi';
import { encodePayload } from '../../lib/social/codec';
import { outcomeLabel, shareLink } from '../../lib/share';
import { XP, awardXp } from '../../lib/rewards';
import { track } from '../../lib/analytics';

interface DefiComposerProps {
  isOpen: boolean;
  friendName?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const autoHint = (r: Restaurant): string => {
  const q = r.lat !== undefined && r.lng !== undefined ? quartierFor(r.lat, r.lng) : null;
  return [r.cuisine, q ? `quartier ${q}` : null, r.price > 0 ? `~${r.price} €` : null].filter(Boolean).join(' · ');
};

/** Choisis un de tes coups de cœur pour un ami : il ne verra qu'un indice. */
export function DefiComposer({ isOpen, friendName, onClose, onToast }: DefiComposerProps) {
  const [likes, setLikes] = useState<Restaurant[]>([]);
  const [picked, setPicked] = useState<Restaurant | null>(null);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const list = readJson<Restaurant[]>('fooder_likes', []).slice().reverse();
    setLikes(list);
    setPicked(list[0] ?? null);
    setHint(list[0] ? autoHint(list[0]) : '');
  }, [isOpen]);

  const pick = (r: Restaurant) => {
    setPicked(r);
    setHint(autoHint(r));
  };

  const send = async () => {
    if (!picked) return;
    const defi: Defi = {
      v: 1,
      id: randomId('d'),
      from: getMe().name,
      restId: picked.id,
      name: picked.name,
      cuisine: picked.cuisine,
      quartier: picked.lat !== undefined && picked.lng !== undefined ? quartierFor(picked.lat, picked.lng) ?? '' : '',
      hint: hint.trim().slice(0, MAX_HINT),
      lat: picked.lat,
      lng: picked.lng,
      at: Date.now(),
    };
    const url = `${window.location.origin}/defi#d=${await encodePayload(defi)}`;
    const outcome = await shareLink({
      title: 'Défi Fooder',
      text: `${defi.from} te lance un défi à l’aveugle : un resto mystère t’attend. Indice : ${defi.hint || 'surprise !'}`,
      url,
    });
    if (outcome === 'shared' || outcome === 'copied') {
      awardXp(XP.defiSent);
      track('defi_sent', { outcome });
      onClose();
    }
    const msg = outcomeLabel(outcome);
    if (msg) onToast(msg);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[140] flex items-end justify-center p-3 bg-plum/60 backdrop-blur-sm'
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className='w-full max-w-md max-h-[calc(100dvh-1.5rem)] bg-cream rounded-[32px] panel flex flex-col overflow-hidden'
            role='dialog'
            aria-label='Lancer un défi à l’aveugle'
          >
            <div className='flex items-start justify-between gap-3 p-5 pb-3 border-b-[3px] border-plum'>
              <div>
                <h2 className='text-[26px] leading-none text-plum'>Défi à l’aveugle</h2>
                <p className='text-xs font-medium text-slate-600 mt-1'>
                  {friendName ? `${friendName} ne verra que l’indice.` : 'Ton ami ne verra que l’indice.'} Le nom se révèle sur place.
                </p>
              </div>
              <button onClick={onClose} aria-label='Fermer' className='w-10 h-10 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard'>
                <X className='w-4 h-4' strokeWidth={3} />
              </button>
            </div>

            {likes.length === 0 ? (
              <p className='p-6 text-sm font-bold text-plum/70 text-center'>Like d’abord quelques restos pour pouvoir en proposer un.</p>
            ) : (
              <>
                <ul className='scroll-y px-4 py-3 space-y-2 flex-1 min-h-0'>
                  {likes.map(r => (
                    <li key={r.id}>
                      <button
                        onClick={() => pick(r)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border-[3px] text-left ${picked?.id === r.id ? 'border-plum bg-white shadow-hard' : 'border-transparent'}`}
                      >
                        <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={40} />
                        <span className='min-w-0'>
                          <span className='block font-bold text-sm text-plum truncate'>{r.name}</span>
                          <span className='block text-[11px] font-bold text-plum/50 truncate'>{r.cuisine}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className='p-4 pt-3 space-y-2.5 border-t-[3px] border-plum'>
                  <label className='block text-[11px] font-black text-plum/60' htmlFor='defi-hint'>Indice visible</label>
                  <input
                    id='defi-hint'
                    value={hint}
                    maxLength={MAX_HINT}
                    onChange={e => setHint(e.target.value)}
                    className='w-full rounded-xl border-[3px] border-plum bg-white px-3 py-2 text-sm font-bold text-plum'
                  />
                  <button onClick={send} disabled={!picked} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base disabled:opacity-60'>
                    Envoyer le défi
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
