'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Camera, Search, X } from 'lucide-react';
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
  preset?: LikedRestaurant | null;
  onClose: () => void;
  onPublish: (result: ComposeResult) => boolean;
}

export function ComposeSheet({ isOpen, liked, preset, onClose, onPublish }: ComposeSheetProps) {
  const [picked, setPicked] = useState<LikedRestaurant | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LikedRestaurant[]>([]);
  const [searching, setSearching] = useState(false);
  const [caption, setCaption] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('miam');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPicked(preset ?? liked[0] ?? null);
      setQuery('');
      setResults([]);
      setCaption('');
      setVerdict('miam');
      setPhoto(undefined);
      setError(null);
    }
  }, [isOpen, liked, preset]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/restaurants/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json();
        setResults(json.success ? (json.data as LikedRestaurant[]) : []);
      } catch {
        /* requête annulée ou réseau coupé : on garde l'ancien état */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

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
    if (!picked) return;
    const ok = onPublish({ restaurant: picked, caption: caption.trim(), verdict, photo });
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

              <div className='space-y-3'>
                {picked ? (
                  <div className='flex items-center gap-3 bg-white rounded-2xl border-[3px] border-plum shadow-hard p-2.5'>
                    <Sticker name={stickerFor(picked.cuisine, picked.id, picked.name)} size={44} className='shrink-0' />
                    <div className='min-w-0 flex-1'>
                      <p className='font-bold text-sm text-plum truncate'>{picked.name}</p>
                      <p className='text-[11px] font-semibold text-plum/60 truncate'>{picked.cuisine}</p>
                    </div>
                    <button onClick={() => setPicked(null)} className='text-xs font-bold text-plum underline min-h-[44px] px-2'>
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <label className='flex items-center gap-2 rounded-full border-[3px] border-plum bg-white px-4 py-2.5 focus-within:shadow-hard'>
                      <Search className='w-4 h-4 text-plum/60 shrink-0' strokeWidth={3} />
                      <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder='Quel restaurant ?'
                        aria-label='Chercher un restaurant'
                        autoComplete='off'
                        className='flex-1 min-w-0 bg-transparent text-base font-medium text-plum outline-none'
                      />
                    </label>
                    {query.trim().length >= 2 && (
                      <ul className='rounded-2xl border-[3px] border-plum bg-white divide-y-2 divide-dashed divide-plum/15 overflow-hidden'>
                        {results.map(r => (
                          <li key={r.id}>
                            <button onClick={() => setPicked(r)} className='w-full flex items-center gap-2 px-3 py-2 text-left active:bg-cream'>
                              <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={32} className='shrink-0' />
                              <span className='min-w-0'>
                                <span className='block text-sm font-bold text-plum truncate'>{r.name}</span>
                                <span className='block text-[11px] font-semibold text-plum/60 truncate'>{r.cuisine}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {!searching && results.length === 0 && (
                          <li className='px-3 py-3 text-xs font-bold text-plum/60'>Aucun résultat. Essaie un autre nom.</li>
                        )}
                      </ul>
                    )}
                    {query.trim().length < 2 && liked.length > 0 && (
                      <div>
                        <p className='text-[11px] font-bold text-plum/50 mb-1.5'>Tes likes</p>
                        <div className='flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1'>
                          {liked.map(r => (
                            <button
                              key={r.id}
                              onClick={() => setPicked(r)}
                              className='shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-2xl border-[3px] border-plum bg-white text-xs font-bold text-plum max-w-[180px]'
                            >
                              <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={30} className='shrink-0' />
                              <span className='truncate'>{r.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {(
                <>
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
                        <span className='text-xs font-bold'>Ajouter une photo du plat ou du lieu</span>
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
                  <button onClick={publish} disabled={!picked} className='duo-button w-full bg-bubblegum text-plum disabled:opacity-50'>
                    Publier
                  </button>
                  <p className='text-[11px] font-semibold text-plum/50 text-center leading-snug'>
                    En publiant, tu confirmes être l&apos;auteur de la photo et qu&apos;elle respecte les{' '}
                    <Link href='/legal/community' className='underline'>règles de la communauté</Link>. Elle pourra illustrer la fiche du restaurant. Pour l&apos;instant, elle reste sur ce téléphone.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
