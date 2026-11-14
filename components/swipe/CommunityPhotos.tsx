'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Heart, Maximize2 } from 'lucide-react';
import type { Restaurant } from '../../data/mockRestaurants';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../profile/Avatar';
import { Lightbox } from '../ui/Lightbox';
import { runWithSession } from '../../lib/cloud/gate';
import { CommunityPhotoPost, fetchCommunityPhotoPosts, setCloudPostLike } from '../../lib/cloud/social';
import { POSTS_KEY, POST_LIKES_KEY } from '../../lib/feed';
import { readJson, writeJson } from '../../lib/store';
import {
  authorLabel,
  canLike,
  cardPhotoPostId,
  displayLikes,
  heartsLabel,
  localPhotoPosts,
  mergeCommunityPosts,
  photoAlt,
  toggleSet,
  viewerLine,
} from './communityPhotosLogic';

type Status = 'loading' | 'ready' | 'error';

const LIKE_ERROR = 'Ton ♥ n’a pas pu être envoyé. Réessaie dans un instant.';

const asIdList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Photos du resto (miennes + serveur), mes cœurs, et le cœur optimiste avec retour arrière en cas d'échec. */
function useCommunityPhotos(restId: string | undefined) {
  const { uid, enabled } = useAuth();
  const [entries, setEntries] = useState<CommunityPhotoPost[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const likedRef = useRef<ReadonlySet<string>>(new Set());
  const pendingRef = useRef<ReadonlySet<string>>(new Set());

  const setLikedBoth = (next: ReadonlySet<string>) => {
    likedRef.current = next;
    setLiked(next);
  };
  const setPendingBoth = (next: ReadonlySet<string>) => {
    pendingRef.current = next;
    setPending(next);
  };

  useEffect(() => {
    setNotice(null);
    setPendingBoth(new Set());
    if (!restId) {
      setEntries([]);
      return;
    }
    const local = localPhotoPosts(readJson<unknown>(POSTS_KEY, []), restId);
    const mineLiked = new Set(asIdList(readJson<unknown>(POST_LIKES_KEY, [])));
    setEntries(mergeCommunityPosts(local, []));
    setLikedBoth(mineLiked);
    if (!enabled) {
      setStatus('ready');
      return;
    }
    let alive = true;
    setStatus('loading');
    fetchCommunityPhotoPosts(restId, uid)
      .then(cloud => {
        if (!alive) return;
        const merged = mergeCommunityPosts(local, cloud);
        setEntries(merged);
        // Mon cœur connu du serveur ou déjà enregistré sur cet appareil.
        setLikedBoth(new Set(Array.from(mineLiked).concat(cloud.filter(c => c.likedByMe).map(c => c.postId))));
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [restId, uid, enabled]);

  const persistLocalLike = (postId: string, nowLiked: boolean) => {
    const list = asIdList(readJson<unknown>(POST_LIKES_KEY, []));
    const has = list.includes(postId);
    if (nowLiked && !has) writeJson(POST_LIKES_KEY, [...list, postId]);
    if (!nowLiked && has) writeJson(POST_LIKES_KEY, list.filter(x => x !== postId));
  };

  /** Un seul cœur par personne : le toucher bascule. Optimiste, puis retour arrière si l'envoi échoue. */
  const toggleLike = useCallback(async (entry: CommunityPhotoPost) => {
    const id = entry.postId;
    if (!canLike(entry) || pendingRef.current.has(id)) return;
    const wasLiked = likedRef.current.has(id);
    setNotice(null);
    setLikedBoth(toggleSet(likedRef.current, id));
    setPendingBoth(new Set(Array.from(pendingRef.current).concat(id)));
    let ok = false;
    try {
      const res = await runWithSession(sessionUid => setCloudPostLike(id, sessionUid, !wasLiked));
      ok = res.ok && res.value === true;
    } catch {
      ok = false;
    }
    setPendingBoth(toggleSet(pendingRef.current, id));
    if (ok) {
      persistLocalLike(id, !wasLiked);
    } else {
      // Retour arrière : on remet l'état d'avant (et donc le compteur d'avant).
      const current = likedRef.current.has(id);
      if (current !== wasLiked) setLikedBoth(toggleSet(likedRef.current, id));
      setNotice(LIKE_ERROR);
    }
  }, []);

  return { entries, status, liked, pending, notice, toggleLike };
}

interface CommunityPhotosProps {
  rest: Restaurant;
}

const addPhotoHref = (rest: Restaurant): string =>
  `/feed?photo=${encodeURIComponent(rest.id)}&n=${encodeURIComponent(rest.name)}&c=${encodeURIComponent(rest.cuisine)}`;

function AddPhotoLink({ rest, label }: { rest: Restaurant; label: string }) {
  return (
    <Link
      href={addPhotoHref(rest)}
      className='mt-3 flex min-h-[48px] items-center justify-center gap-2 px-4 py-3 bg-bubblegum border-[3px] border-plum text-plum font-bold text-sm rounded-full shadow-hard active:translate-y-0.5 transition-transform text-center'
    >
      <Camera className='w-4 h-4 shrink-0' strokeWidth={2.5} /> {label}
    </Link>
  );
}

/** Section « Photos de la communauté » de la fiche d'un restaurant. */
export function CommunityPhotos({ rest }: CommunityPhotosProps) {
  const { entries, status, liked, pending, notice, toggleLike } = useCommunityPhotos(rest.id);
  const [viewer, setViewer] = useState<number | null>(null);
  useEffect(() => setViewer(null), [rest.id]);
  const badgeId = cardPhotoPostId(entries, rest);
  const likesOf = (e: CommunityPhotoPost) => displayLikes(e, liked.has(e.postId));
  const open = viewer !== null && entries[viewer] ? entries[viewer] : null;

  return (
    <section aria-labelledby='fiche-communaute'>
      <div className='flex items-center gap-3 mb-4'>
        <div className='w-9 h-9 shrink-0 bg-fooder-secondary border-2 border-plum rounded-xl flex items-center justify-center shadow-[2px_2px_0_#2B0F3A]'>
          <Camera className='w-4 h-4 text-plum' strokeWidth={2.5} />
        </div>
        <h3 id='fiche-communaute' className='text-xl text-plum min-w-0'>
          Photos de la communauté
        </h3>
      </div>

      {status === 'loading' && entries.length === 0 && (
        <div role='status' aria-live='polite' className='flex gap-3'>
          <span className='sr-only'>Chargement des photos de la communauté…</span>
          {[0, 1].map(i => (
            <span key={i} aria-hidden='true' className='h-24 flex-1 rounded-[22px] border-[3px] border-dashed border-plum/25 bg-white/60 motion-safe:animate-pulse' />
          ))}
        </div>
      )}

      {status !== 'loading' && entries.length === 0 && (
        <div className='p-4 bg-white border-[3px] border-dashed border-plum rounded-[22px]'>
          <div className='flex items-center gap-3'>
            <span className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
              <Camera className='w-5 h-5 text-plum' strokeWidth={2.5} />
            </span>
            <p className='min-w-0 font-bold text-plum text-base leading-tight'>
              Pas encore de photo de la communauté. Sois le premier : poste le plat que tu as mangé.
            </p>
          </div>
          {status === 'error' && (
            <p role='status' className='mt-2 text-xs font-medium text-plum-muted'>
              Les photos en ligne ne se chargent pas pour l’instant.
            </p>
          )}
          <AddPhotoLink rest={rest} label='Poster le plat que j’ai mangé' />
        </div>
      )}

      {entries.length > 0 && (
        <>
          <ul className='flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-5 px-5 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible'>
            {entries.map((e, i) => {
              const count = likesOf(e);
              const name = authorLabel(e);
              const isLiked = liked.has(e.postId);
              return (
                <li
                  key={e.postId}
                  className='snap-start shrink-0 w-[min(176px,56vw)] md:w-auto bg-white rounded-[22px] border-[3px] border-plum shadow-hard-sm overflow-hidden'
                >
                  <div className='relative'>
                    <button
                      type='button'
                      onClick={() => setViewer(i)}
                      className='block w-full cursor-zoom-in'
                      aria-label={`Agrandir : ${photoAlt(e, rest.name, i, entries.length)}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.url}
                        alt={photoAlt(e, rest.name, i, entries.length)}
                        width={176}
                        height={176}
                        loading='lazy'
                        decoding='async'
                        draggable={false}
                        className='block w-full aspect-square object-cover bg-cream'
                      />
                      <span aria-hidden='true' className='absolute top-2 right-2 w-8 h-8 bg-white/90 border-2 border-plum rounded-full flex items-center justify-center'>
                        <Maximize2 className='w-3.5 h-3.5 text-plum' strokeWidth={3} />
                      </span>
                    </button>
                    {badgeId === e.postId && (
                      <span className='chip absolute left-2 top-2 max-w-[calc(100%-56px)] !items-start bg-fooder-secondary text-plum !text-[10px] !px-2 !py-1 leading-tight'>
                        Photo affichée sur la carte
                      </span>
                    )}
                  </div>
                  <div className='flex items-center justify-between gap-1 pl-2.5 pr-1'>
                    <div className='flex items-center gap-1.5 min-w-0 text-xs font-bold text-plum'>
                      {e.author && <Avatar avatar={e.author.avatar} size={24} className='!border-2 !shadow-none' />}
                      <span className='truncate'>{name ?? 'Un foodie'}</span>
                    </div>
                    {canLike(e) ? (
                      <button
                        type='button'
                        onClick={() => void toggleLike(e)}
                        disabled={pending.has(e.postId)}
                        aria-pressed={isLiked}
                        aria-label={`${isLiked ? 'Retirer mon cœur de' : 'Aimer'} cette photo${name ? ` de ${name}` : ''}. ${heartsLabel(count)}`}
                        className='flex shrink-0 items-center gap-1 min-h-[44px] min-w-[44px] justify-center px-2 text-sm font-bold text-plum tabular-nums disabled:opacity-60'
                      >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-bubblegum' : ''}`} strokeWidth={2.5} />
                        {count}
                      </button>
                    ) : (
                      <span
                        role='img'
                        aria-label={`${e.mine ? 'Ta photo. ' : ''}${heartsLabel(count)}`}
                        className='flex shrink-0 items-center gap-1 min-h-[44px] px-2 text-sm font-bold text-plum-muted tabular-nums'
                      >
                        <Heart className='w-5 h-5' strokeWidth={2.5} aria-hidden='true' />
                        {count}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {notice && (
            <p role='status' className='text-xs font-bold text-danger'>
              {notice}
            </p>
          )}
          <AddPhotoLink rest={rest} label='Ajouter ma photo' />
        </>
      )}

      {viewer !== null && open && (
        <Lightbox
          images={entries.map(e => e.url)}
          index={viewer}
          alt={`Photo de la communauté chez ${rest.name}`}
          credit={viewerLine(open, likesOf(open))}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
