'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Eye, MapPin } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { DefiComposer } from '../../../components/social/DefiComposer';
import { CheckinSheet } from '../../../components/checkin/CheckinSheet';
import { Sticker } from '../../../components/ui/Sticker';
import { useToast } from '../../../components/ui/Toast';
import { useSocial } from '../../../hooks/useSocial';
import { decodePayload, readHashParam } from '../../../lib/social/codec';
import { StoredDefi, parseDefi, saveDefi, updateDefi } from '../../../lib/social/defi';
import { stickerFor } from '../../../lib/stickers';
import { XP, awardXp, unlockAchievement } from '../../../lib/rewards';
import { timeAgo } from '../../../lib/feed';
import { track } from '../../../lib/analytics';

const directions = (d: StoredDefi) =>
  d.lat !== undefined && d.lng !== undefined
    ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=walking`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name} Toulouse`)}`;

export default function DefiPage() {
  const { defis } = useSocial();
  const [composer, setComposer] = useState(false);
  const [visiting, setVisiting] = useState<StoredDefi | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const ingest = async () => {
      const raw = readHashParam('d');
      if (!raw) return;
      window.history.replaceState(null, '', '/defi');
      const defi = parseDefi(await decodePayload(raw));
      if (!defi) return setNotice('Ce défi est illisible. Demande qu’on te le renvoie.');
      if (saveDefi(defi) === 'added') {
        track('defi_received');
        toast.show(`Nouveau défi de ${defi.from} !`);
      }
    };
    ingest();
    window.addEventListener('hashchange', ingest);
    return () => window.removeEventListener('hashchange', ingest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Défis'
        subtitle='Un ami choisit, tu découvres sur place'
        right={
          <Link href='/amis' aria-label='Retour aux amis' className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard shrink-0'>
            <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
        }
      />

      <div className='flex-1 min-h-0 scroll-y px-4 py-4 space-y-4'>
        {notice && <p className='bg-white rounded-2xl border-[3px] border-plum p-3 text-sm font-bold text-plum'>{notice}</p>}

        <button onClick={() => setComposer(true)} className='w-full duo-button bg-fooder-secondary text-plum py-4 text-base'>
          Lancer un défi à un ami
        </button>

        {defis.length === 0 ? (
          <div className='flex flex-col items-center text-center gap-2 py-8'>
            <Sticker name='b_dice' size={90} rotate={-8} className='bob' />
            <p className='font-display text-xl text-plum'>Aucun défi reçu</p>
            <p className='text-sm font-medium text-slate-600'>Lance le premier : tes amis te renverront la pareille.</p>
          </div>
        ) : (
          <ul className='space-y-3'>
            <AnimatePresence initial={false}>
              {defis.map(d => (
                <motion.li key={d.id} layout className={`rounded-[28px] border-[3px] border-plum shadow-hard p-4 space-y-3 ${d.done ? 'bg-white/70' : 'bg-white'}`}>
                  <div className='flex items-start gap-3'>
                    <Sticker name={d.revealed ? stickerFor(d.cuisine, d.restId, d.name) : 'b_dice'} size={56} rotate={-8} className='shrink-0' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-[11px] font-black text-plum/60'>De {d.from} · {timeAgo(d.at)}</p>
                      <h2 className='text-2xl leading-tight text-plum break-words'>{d.revealed ? d.name : 'Resto mystère'}</h2>
                      <p className='text-sm font-bold text-plum/80'>Indice : {d.hint || 'aucun, fais confiance !'}</p>
                    </div>
                    {d.done && (
                      <span className='chip bg-fooder-mint text-plum text-xs shrink-0'>
                        <Check className='w-3 h-3' strokeWidth={3} /> Relevé
                      </span>
                    )}
                  </div>
                  {!d.done && (
                    d.revealed ? (
                      <div className='grid grid-cols-2 gap-2'>
                        <a href={directions(d)} target='_blank' rel='noopener noreferrer' className='duo-button bg-white text-plum py-3 text-sm flex items-center justify-center gap-1.5'>
                          <MapPin className='w-4 h-4' /> Y aller
                        </a>
                        <button onClick={() => setVisiting(d)} className='duo-button bg-fooder-mint text-plum py-3 text-sm'>
                          J’y suis !
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => updateDefi(d.id, { revealed: true })} className='w-full duo-button bg-bubblegum text-plum py-3 text-sm flex items-center justify-center gap-2'>
                        <Eye className='w-4 h-4' strokeWidth={2.5} /> Je relève le défi, révèle le resto
                      </button>
                    )
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <DefiComposer isOpen={composer} onClose={() => setComposer(false)} onToast={toast.show} />
      <CheckinSheet
        target={visiting ? { restId: visiting.restId, name: visiting.name, cuisine: visiting.cuisine, lat: visiting.lat, lng: visiting.lng } : null}
        mode='confirm'
        onClose={() => setVisiting(null)}
        onVisited={() => {
          if (!visiting) return;
          updateDefi(visiting.id, { done: true });
          awardXp(XP.defiDone);
          unlockAchievement('defi_1');
        }}
      />
      {toast.node}
    </div>
  );
}
