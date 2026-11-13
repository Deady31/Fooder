'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Search, X } from 'lucide-react';
import { MAX_CAPTION, VERDICTS, Verdict, compressImage } from '../../lib/feed';
import { stickerFor } from '../../lib/stickers';
import { Sticker } from '../ui/Sticker';
import { Sheet } from '../ui/Sheet';
import { createPublishLock } from './feedLogic';
import { DISH_PHOTO_TIP } from '../../lib/photoInvite';
import { PHOTO_XP_FIRST, PHOTO_XP_REPEAT } from '../../lib/photoXp';
import { uploadStatusText, useUploadQueue } from '../../hooks/useFeed';
import type { UploadStatus } from '../../lib/cloud/uploadQueue';

interface UploadNoticeProps {
  status: UploadStatus | undefined;
  prefix?: string;
  onRetry: () => void;
}

/** État d'envoi en ligne d'une publication : en cours, publiée, ou en attente avec la raison et un bouton « Réessayer ». */
export function UploadNotice({ status, prefix = '', onRetry }: UploadNoticeProps) {
  const text = uploadStatusText(status);
  if (!status || !text) return null;
  const canRetry = status.state === 'pending' || (status.state === 'failed' && status.reason === 'queue_full');
  const tone = status.state === 'sending' ? 'text-plum-muted' : 'text-plum';
  return (
    <div role='status' aria-live='polite' className='flex items-start gap-2 rounded-2xl border-[3px] border-plum/30 bg-white p-3 text-left'>
      <p className={`flex-1 text-xs font-bold leading-snug ${tone}`}>{prefix}{text}</p>
      {canRetry && (
        <button onClick={onRetry} className='shrink-0 min-h-[44px] px-3 rounded-full border-[3px] border-plum bg-lemon text-xs font-bold text-plum active:translate-y-0.5'>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Texte du verdict : teintes accessibles (les couleurs vives restent pour le contour). */
const VERDICT_INK: Record<string, string> = { miam: '#0B7A47', bof: '#C4105E', atester: '#6C2BFF' };

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
  const [searchError, setSearchError] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(createPublishLock());
  const [caption, setCaption] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('miam');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, retry } = useUploadQueue();

  useEffect(() => {
    if (isOpen) {
      setPicked(preset ?? liked[0] ?? null);
      setQuery('');
      setResults([]);
      setCaption('');
      setVerdict('miam');
      setPhoto(undefined);
      setError(null);
      setSearchError(false);
      setBusy(false);
      lock.current.reset();
    }
  }, [isOpen, liked, preset]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const res = await fetch(`/api/restaurants/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error('search_failed');
        setResults(json.data as LikedRestaurant[]);
      } catch {
        // Requête annulée : rien à dire. Réseau coupé ou erreur serveur : état distinct du « aucun résultat ».
        if (!ctrl.signal.aborted) {
          setResults([]);
          setSearchError(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
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
    if (!picked || busy) return;
    // Verrou synchrone : un second appui avant le re-rendu ne crée pas de second post.
    lock.current.run(() => {
      const ok = onPublish({ restaurant: picked, caption: caption.trim(), verdict, photo });
      if (ok) {
        setBusy(true);
        onClose();
      } else {
        setError('Stockage plein : retire une ancienne photo.');
      }
      return ok;
    });
  };

  return (
    <Sheet open={isOpen} onClose={onClose} labelledBy='compose-titre' className='bg-cream rounded-[32px] panel'>
            <div className='p-[clamp(16px,5vw,24px)] space-y-4'>
              <div className='flex items-start justify-between gap-3'>
                <h2 id='compose-titre' className='text-[clamp(21px,6.6vw,28px)] leading-[1.05] text-plum min-w-0 flex-1'>Partager un resto</h2>
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
                      <p className='text-[11px] font-semibold text-plum-muted truncate'>{picked.cuisine}</p>
                    </div>
                    <button onClick={() => setPicked(null)} className='text-xs font-bold text-plum underline min-h-[44px] px-2'>
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <label className='flex items-center gap-2 rounded-full border-[3px] border-plum bg-white px-4 py-2.5 focus-within:shadow-hard'>
                      <Search className='w-4 h-4 text-plum-muted shrink-0' strokeWidth={3} />
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
                            <button onClick={() => setPicked(r)} className='w-full min-h-[44px] flex items-center gap-2 px-3 py-2 text-left active:bg-cream'>
                              <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={32} className='shrink-0' />
                              <span className='min-w-0'>
                                <span className='block text-sm font-bold text-plum truncate'>{r.name}</span>
                                <span className='block text-[11px] font-semibold text-plum-muted truncate'>{r.cuisine}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {searching && <li className='px-3 py-3 text-xs font-bold text-plum-muted'>Recherche…</li>}
                        {!searching && searchError && (
                          <li role='alert' className='px-3 py-3 text-xs font-bold text-plum'>
                            Recherche impossible pour le moment (connexion ?). Choisis plutôt un de tes likes.
                          </li>
                        )}
                        {!searching && !searchError && results.length === 0 && (
                          <li className='px-3 py-3 text-xs font-bold text-plum-muted'>Aucun résultat. Essaie un autre nom.</li>
                        )}
                      </ul>
                    )}
                    {query.trim().length < 2 && liked.length > 0 && (
                      <div>
                        <p className='text-[11px] font-bold text-plum-muted mb-1.5'>Tes likes</p>
                        <div className='flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1'>
                          {liked.map(r => (
                            <button
                              key={r.id}
                              onClick={() => setPicked(r)}
                              className='shrink-0 min-h-[44px] flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-2xl border-[3px] border-plum bg-white text-xs font-bold text-plum max-w-[180px]'
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
                        className={`font-display text-lg leading-none min-h-[44px] py-2.5 rounded-xl border-[3px] transition-all active:scale-95 ${verdict === v.id ? 'bg-white shadow-hard -rotate-2' : 'bg-cream/60 opacity-70'}`}
                        style={{ color: VERDICT_INK[v.id] ?? '#2B0F3A', borderColor: v.color }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <div className='flex items-start gap-2.5 rounded-2xl bg-fooder-secondary/40 border-2 border-plum/30 px-3 py-2'>
                    <Camera className='w-4 h-4 mt-0.5 shrink-0 text-plum' strokeWidth={2.5} aria-hidden='true' />
                    <div className='text-xs leading-snug text-plum'>
                      <p className='font-bold'>{DISH_PHOTO_TIP.title}</p>
                      <p className='font-medium text-plum-muted'>{DISH_PHOTO_TIP.example}</p>
                      <p className='mt-1 font-bold'><span aria-hidden='true'>✓</span> le plat dans l’assiette · <span aria-hidden='true'>✗</span> la devanture</p>
                    </div>
                  </div>

                  <button
                    onClick={() => fileRef.current?.click()}
                    className='relative w-full aspect-[16/9] rounded-2xl border-[3px] border-dashed border-plum/50 bg-white flex flex-col items-center justify-center gap-1 text-plum-muted overflow-hidden active:scale-[0.99] transition-transform'
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt='Aperçu' className='absolute inset-0 w-full h-full object-cover' />
                    ) : (
                      <>
                        <Camera className='w-7 h-7' strokeWidth={2.5} />
                        <span className='text-xs font-bold'>Ajouter une photo du plat</span>
                      </>
                    )}
                  </button>
                  <input ref={fileRef} type='file' accept='image/*' hidden onChange={e => onFile(e.target.files?.[0])} />
                  <p className='-mt-2 text-center text-[11px] font-bold text-plum-muted'>
                    Photo du plat : +{PHOTO_XP_FIRST} XP si c’est la première de ce resto, sinon +{PHOTO_XP_REPEAT} XP.
                  </p>

                  <div>
                    <textarea
                      value={caption}
                      maxLength={MAX_CAPTION}
                      onChange={e => setCaption(e.target.value)}
                      rows={3}
                      placeholder='Un mot sur ce resto ?'
                      className='w-full rounded-2xl border-[3px] border-plum bg-white p-3 text-base font-medium text-plum resize-none outline-none focus:shadow-hard'
                    />
                    <p className='text-right text-[11px] font-bold text-plum-muted'>{caption.length}/{MAX_CAPTION}</p>
                  </div>

                  {error && <p role='alert' className='text-xs font-bold text-danger'>{error}</p>}
                  {pending.length > 0 && (
                    <UploadNotice
                      status={{ state: 'pending', reason: pending[0].reason ?? 'offline' }}
                      prefix={`${pending.length} publication${pending.length > 1 ? 's' : ''} en attente d’envoi. `}
                      onRetry={() => retry()}
                    />
                  )}
                  <button onClick={publish} disabled={!picked || busy} className='duo-button w-full min-h-[44px] bg-bubblegum text-plum disabled:opacity-50'>
                    Publier
                  </button>
                  <p className='text-[11px] font-semibold text-plum-muted text-center leading-snug'>
                    En publiant, tu confirmes être l&apos;auteur de la photo et qu&apos;elle respecte les{' '}
                    <Link href='/legal/community' className='underline'>règles de la communauté</Link>. Elle sera visible des autres utilisateurs et pourra illustrer la fiche du restaurant. Hors ligne ou sans compte, elle reste sur ce téléphone.
                  </p>
                </>
              )}
            </div>
    </Sheet>
  );
}
