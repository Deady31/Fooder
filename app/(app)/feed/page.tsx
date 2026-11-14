'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Plus, Search, Trophy, Users, X } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { PostCard } from '../../../components/feed/PostCard';
import { ComposeSheet, ComposeResult, LikedRestaurant } from '../../../components/feed/ComposeSheet';
import { useDebouncedValue } from '../../../components/feed/useDebouncedValue';
import { FeedFilterBar } from '../../../components/feed/FeedFilterBar';
import { InviteCard } from '../../../components/social/InviteCard';
import { MAX_QUERY, parseQueryParam, searchView } from '../../../components/feed/reviewSearch';
import {
  DEFAULT_FILTERS, FILTERS_KEY, FeedFilters, applyFeedFilters, filtersToQuery, hasActiveFilters, parseFilters, parseStoredFilters, restaurantOptions,
} from '../../../components/feed/feedFilters';
import { readJson, writeJson } from '../../../lib/store';
import { useFeed } from '../../../hooks/useFeed';
import { useAvatar } from '../../../hooks/useAvatar';
import { useGamification } from '../../../hooks/useGamification';
import { stickerFor } from '../../../lib/stickers';
import { track } from '../../../lib/analytics';
import { newPostId } from '../../../lib/share';
import { isSharable } from '../../../lib/restoShare';
import { verdictSlug } from '../../../lib/usageProps';
import { useToast } from '../../../components/ui/Toast';

function readLiked(): LikedRestaurant[] {
  try {
    const list = JSON.parse(localStorage.getItem('fooder_likes') || '[]') as LikedRestaurant[];
    return list.map(r => ({ id: r.id, name: r.name, cuisine: r.cuisine }));
  } catch {
    return [];
  }
}

function FeedSkeleton() {
  return (
    <div role='status' aria-label='Chargement du fil' className='space-y-4'>
      {[0, 1, 2].map(i => (
        <div key={i} className='bg-white rounded-2xl border-[3px] border-plum shadow-hard p-4 animate-pulse' aria-hidden='true'>
          <div className='h-7 w-16 rounded-lg bg-plum/10' />
          <div className='mt-3 h-6 w-3/4 rounded bg-plum/10' />
          <div className='mt-2 h-3 w-1/2 rounded bg-plum/10' />
          <div className='mt-4 h-12 rounded-xl bg-plum/10' />
        </div>
      ))}
    </div>
  );
}

interface EmptyResultsProps {
  query: string;
  filters: FeedFilters;
  hasFriends: boolean;
  onCompose: () => void;
  onClearSearch: () => void;
  onReset: () => void;
}

/** État vide du Fil : une consigne utile selon ce qui est filtré. */
function EmptyResults({ query, filters, hasFriends, onCompose, onClearSearch, onReset }: EmptyResultsProps) {
  const friendsOnly = !query && filters.scope === 'amis' && !filters.resto;
  const meOnly = !query && filters.scope === 'moi' && !filters.resto;
  const title = query ? 'Aucun avis trouvé' : friendsOnly ? 'Rien de tes amis' : meOnly ? 'Rien de ton côté' : 'Aucun avis ici';
  const text = query
    ? `Aucun avis pour « ${query} »${hasActiveFilters(filters) ? ' avec ces filtres' : ''} : sois le premier à en poster un.`
    : friendsOnly
      ? hasFriends
        ? 'Aucun de tes amis n’a encore posté : invite-en.'
        : 'Tu n’as pas encore d’amis sur Fooder : invite-en.'
      : meOnly
        ? 'Tu n’as encore rien posté ni confirmé de visite.'
        : 'Aucun avis ne correspond à ces filtres.';
  return (
    <section className='bg-white rounded-2xl border-[3px] border-plum shadow-hard p-4 space-y-3'>
      <h2 className='text-xl leading-tight text-plum'>{title}</h2>
      <p className='text-sm font-medium text-plum-muted leading-snug'>{text}</p>
      {friendsOnly && <InviteCard variant='banner' showInstall={false} />}
      <div className='flex flex-wrap gap-2'>
        {!friendsOnly && (
          <button onClick={onCompose} className='duo-button min-h-[44px] bg-bubblegum text-plum text-sm py-2.5'>
            Poster un avis
          </button>
        )}
        {query && (
          <button onClick={onClearSearch} className='duo-button min-h-[44px] bg-white text-plum text-sm py-2.5'>
            Effacer la recherche
          </button>
        )}
        {hasActiveFilters(filters) && (
          <button onClick={onReset} className='duo-button min-h-[44px] bg-white text-plum text-sm py-2.5'>
            Réinitialiser
          </button>
        )}
      </div>
    </section>
  );
}

export default function FeedPage() {
  const { posts, friendIds, liked, ready, remoteLoading, hasDemo, likeCount, addPost, removePost, toggleLike, commentsFor, addComment, editCommentText } = useFeed();
  const { avatar } = useAvatar();
  const { level } = useGamification();
  const [composeOpen, setComposeOpen] = useState(false);
  const [likedRestaurants, setLikedRestaurants] = useState<LikedRestaurant[]>([]);
  const [preset, setPreset] = useState<LikedRestaurant | null>(null);
  const toast = useToast(4000);
  const [typed, setTyped] = useState('');
  const [settled, flushSearch] = useDebouncedValue(typed, 300);
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Filtres : l'URL (?scope=amis&resto=<id>) prime, sinon la dernière sélection mémorisée.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.has('scope') || params.has('resto');
    setFilters(fromUrl ? parseFilters(params) : parseStoredFilters(readJson<unknown>(FILTERS_KEY, null)));
    setFiltersLoaded(true);
  }, []);

  // Mémorisation + URL lisible, sans empiler l'historique ni toucher aux autres paramètres.
  useEffect(() => {
    if (!filtersLoaded) return;
    writeJson(FILTERS_KEY, filters);
    const params = new URLSearchParams(window.location.search);
    params.delete('scope');
    params.delete('resto');
    const qs = [filtersToQuery(filters), params.toString()].filter(Boolean).join('&');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [filters, filtersLoaded]);

  // Lien « avis de ce resto » (/feed?q=…) : la recherche démarre pré-remplie.
  useEffect(() => {
    const q = parseQueryParam(new URLSearchParams(window.location.search).get('q'));
    if (!q) return;
    setTyped(q);
    flushSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrivée depuis une fiche (« Propose la vraie photo ») : on ouvre le formulaire sur ce resto.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('photo');
    if (!id) return;
    window.history.replaceState(null, '', '/feed');
    // L'URL n'est pas fiable : seul l'id compte, nom et cuisine viennent du serveur (route validée, le gros JSON reste côté serveur).
    if (!isSharable(id)) return;
    const ctrl = new AbortController();
    fetch(`/api/restaurants/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(res => (res.ok ? res.json() : null))
      .then((json: { success?: boolean; data?: LikedRestaurant } | null) => {
        if (!json?.success || !json.data) return;
        setPreset({ id: json.data.id, name: json.data.name, cuisine: json.data.cuisine });
        setComposeOpen(true);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    setLikedRestaurants(readLiked());
  }, [composeOpen]);

  const results = useMemo(() => applyFeedFilters(posts, { query: settled, filters, friendIds }), [posts, settled, filters, friendIds]);
  const options = useMemo(() => restaurantOptions(posts), [posts]);
  const filtersOn = hasActiveFilters(filters);
  const typedOn = typed.trim() !== '';
  const view = typedOn
    ? searchView({ typed, settled, resultCount: results.length })
    : filtersOn ? (results.length > 0 ? 'results' : 'empty') : 'idle';
  const searching = view !== 'idle';
  const shown = typedOn || filtersOn ? results : posts;
  const clearSearch = () => {
    setTyped('');
    flushSearch('');
  };
  const resetAll = () => {
    setFilters(DEFAULT_FILTERS);
    clearSearch();
  };

  const publish = ({ restaurant, caption, verdict, photo }: ComposeResult): boolean => {
    const ok = addPost({
      id: newPostId(),
      author: { name: 'Toi', avatar, level },
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      cuisine: restaurant.cuisine,
      sticker: stickerFor(restaurant.cuisine, restaurant.id, restaurant.name),
      caption,
      verdict,
      photo,
      likes: 0,
      createdAt: Date.now(),
      mine: true,
    }, toast.show);
    if (ok) {
      track('post_published', { has_photo: Boolean(photo) });
      if (photo) track('photo_posted', { verdict: verdictSlug(verdict) });
    }
    return ok;
  };

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Le fil'
        subtitle='Les verdicts des foodies de Toulouse'
        right={
          <div className='flex gap-2 shrink-0'>
          <Link
            href='/classement'
            aria-label='Classement'
            className='w-11 h-11 bg-fooder-secondary border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Trophy className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
          <Link
            href='/amis'
            aria-label='Mes amis'
            className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Users className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
          <button
            onClick={() => setComposeOpen(true)}
            aria-label='Partager un resto'
            className='w-11 h-11 bg-bubblegum border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Plus className='w-5 h-5 text-plum' strokeWidth={3.5} />
          </button>
          </div>
        }
      />
      <div className='flex-1 min-h-0 scroll-y px-4 py-4 space-y-4'>
        <form role='search' aria-label='Chercher un avis' onSubmit={e => { e.preventDefault(); flushSearch(typed); }}
          className='flex items-center gap-2 rounded-full border-[3px] border-plum bg-white pl-4 pr-1 min-h-[48px] focus-within:shadow-hard'>
          <Search className='w-4 h-4 text-plum-muted shrink-0' strokeWidth={3} aria-hidden='true' />
          <label htmlFor='fil-recherche' className='sr-only'>Chercher un resto ou un avis</label>
          <input
            id='fil-recherche'
            type='search'
            value={typed}
            onChange={e => setTyped(e.target.value.slice(0, MAX_QUERY))}
            placeholder='Chercher un resto ou un avis'
            autoComplete='off'
            enterKeyHint='search'
            className='flex-1 min-w-0 bg-transparent text-base font-medium text-plum placeholder:text-plum-muted outline-none'
          />
          {typed && (
            <button type='button' onClick={clearSearch} aria-label='Effacer la recherche'
              className='w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-plum'>
              <X className='w-4 h-4' strokeWidth={3} />
            </button>
          )}
        </form>
        {ready && (
          <FeedFilterBar filters={filters} onChange={setFilters} options={options} count={typedOn || filtersOn ? results.length : null} onReset={resetAll} />
        )}
        {!ready ? (
          <FeedSkeleton />
        ) : view === 'loading' ? (
          <p role='status' className='text-sm font-bold text-plum bg-white rounded-2xl border-[3px] border-plum p-4'>Recherche…</p>
        ) : view === 'empty' ? (
          <EmptyResults
            query={typedOn ? settled.trim() : ''}
            filters={filters}
            hasFriends={friendIds.size > 0}
            onCompose={() => setComposeOpen(true)}
            onClearSearch={clearSearch}
            onReset={resetAll}
          />
        ) : (
          <>
            {hasDemo && !searching && (
              <section aria-labelledby='fil-vide' className='bg-white rounded-2xl border-[3px] border-plum shadow-hard p-4 space-y-3'>
                <h2 id='fil-vide' className='text-xl leading-tight text-plum'>Ton fil est vide pour l’instant</h2>
                <p className='text-sm font-medium text-plum-muted leading-snug'>
                  Confirme une visite ou partage un resto : il apparaîtra ici. Les cartes marquées « exemple » ne sont pas de vrais
                  foodies et disparaissent dès ton premier vrai post.
                </p>
                <div className='flex flex-wrap gap-2'>
                  <button onClick={() => setComposeOpen(true)} className='duo-button min-h-[44px] bg-bubblegum text-plum text-sm py-2.5'>
                    Partager un resto
                  </button>
                  <Link href='/swipe' className='duo-button min-h-[44px] inline-flex items-center bg-white text-plum text-sm py-2.5'>
                    Découvrir
                  </Link>
                </div>
              </section>
            )}
            {remoteLoading && !searching && (
              <p role='status' className='text-xs font-bold text-plum bg-white rounded-full border-2 border-plum/30 px-3 py-2 w-fit'>
                Chargement du fil de la ville…
              </p>
            )}
            <AnimatePresence initial={false}>
              {shown.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={liked.includes(post.id)}
                  count={likeCount(post)}
                  comments={commentsFor(post.id)}
                  onLike={toggleLike}
                  onDelete={removePost}
                  onComment={addComment}
                  onEditComment={editCommentText}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
      {toast.node}
      <ComposeSheet isOpen={composeOpen} liked={likedRestaurants}
        preset={preset} onClose={() => { setComposeOpen(false); setPreset(null); }} onPublish={publish} />
    </div>
  );
}
