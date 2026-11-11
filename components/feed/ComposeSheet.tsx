'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, X } from 'lucide-react';
import { MAX_CAPTION, VERDICTS, Verdict, compressImage } from '../../lib/feed';
import { stickerFor } from '../../lib/stickers';
import { Sticker } from '../ui/Sticker';

export interface LikedRestaurant {
  id: string;
  name: string;
  cuisine: string;
}

export interface ComposeResult {
  restaurant: LikedRestaurant;
  caption: string;
  verdict: Verdict;
  photo?: string;
}

interface ComposeSheetProps {
  isOpen: boolean;
  liked: LikedRestaurant[];
  onClose: () => void;
  onPublish: (result: ComposeResult) => boolean;
}

export function ComposeSheet({ isOpen, liked, onClose, onPublish }: ComposeSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('miam');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(liked[0]?.id ?? null);
      setCaption('');
      setVerdict('miam');
      setPhoto(undefined);
      setError(null);
    }
  }, [isOpen, liked]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError(null);
    } catch {
      setError('Photo illisible, essaie une autre image.');
    }
  };

  const publish = () => {
    const restaurant = liked.find(r => r.id === selectedId);
    if (!restaurant) return;
    const ok = onPublish({ restaurant, caption: caption.trim(), verdict, photo });
    if (ok) onClose();
    else setError('Stockage plein : retire une ancienne photo.');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[150] flex items-end justify-center p-3 pb-4 bg-plum/60 backdrop-blur-sm'
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className='w-full max-w-md max-h-[calc(100dvh-1.5rem)] bg-cream rounded-[32px] panel flex flex-col overflow-hidden'
          >
            <div className='p-[clamp(16px,5vw,24px)] space-y-4 scroll-y'>
              <div className='flex items-start justify-between gap-3'>
                <h2 className='text-[clamp(21px,6.6vw,28px)] leading-[1.05] text-plum min-w-0 flex-1'>Partager un resto</h2>
                <button onClick={onClose} aria-label='Fermer' className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'>
                  <X className='w-5 h-5' strokeWidth={3} />
                </button>
              </div>

              {liked.length === 0 ? (
                <p className='text-sm font-bold text-plum/70 text-center py-6'>Like d&apos;abord un resto dans Découvrir, tu pourras le partager ici.</p>
              ) : (
                <>
                  <div className='flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1' role='radiogroup' aria-label='Restaurant à partager'>
                    {liked.map(r => (
                      <button
                        key={r.id}
                        role='radio'
                        aria-checked={selectedId === r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-2xl border-[3px] border-plum text-xs font-bold text-plum max-w-[180px] ${selectedId === r.id ? 'bg-bubblegum shadow-hard' : 'bg-white'}`}
                      >
                        <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={30} className='shrink-0' />
                        <span className='truncate'>{r.name}</span>
                      </button>
                    ))}
                  </div>

                  <div role='radiogroup' aria-label='Ton verdict' className='grid grid-cols-3 gap-2'>
                    {VERDICTS.map(v => (
                      <button
                        key={v.id}
                        role='radio'
                        aria-checked={verdict === v.id}
                        onClick={() => setVerdict(v.id)}
                        className={`font-display text-lg leading-none py-2.5 rounded-xl border-[3px] transition-all active:scale-95 ${verdict === v.id ? 'bg-white shadow-hard -rotate-2' : 'bg-cream/60 opacity-70'}`}
                        style={{ color: v.color, borderColor: v.color }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => fileRef.current?.click()}
                    className='relative w-full aspect-[16/9] rounded-2xl border-[3px] border-dashed border-plum/50 bg-white flex flex-col items-center justify-center gap-1 text-plum/70 overflow-hidden active:scale-[0.99] transition-transform'
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt='Aperçu' className='absolute inset-0 w-full h-full object-cover' />
                    ) : (
                      <>
                        <Camera className='w-7 h-7' strokeWidth={2.5} />
                        <span className='text-xs font-bold'>Ajouter une photo (facultatif)</span>
                      </>
                    )}
                  </button>
                  <input ref={fileRef} type='file' accept='image/*' hidden onChange={e => onFile(e.target.files?.[0])} />

                  <div>
                    <textarea
                      value={caption}
                      maxLength={MAX_CAPTION}
                      onChange={e => setCaption(e.target.value)}
                      rows={3}
                      placeholder='Un mot sur ce resto ?'
                      className='w-full rounded-2xl border-[3px] border-plum bg-white p-3 text-base font-medium text-plum resize-none outline-none focus:shadow-hard'
                    />
                    <p className='text-right text-[11px] font-bold text-plum/50'>{caption.length}/{MAX_CAPTION}</p>
                  </div>

                  {error && <p role='alert' className='text-xs font-bold text-fooder-red'>{error}</p>}
                  <button onClick={publish} disabled={!selectedId} className='duo-button w-full bg-bubblegum text-plum disabled:opacity-50'>
                    Publier
                  </button>
                  <p className='text-[11px] font-semibold text-plum/50 text-center'>Pour l&apos;instant ton post reste sur ce téléphone. Le partage entre amis arrive avec les comptes.</p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
