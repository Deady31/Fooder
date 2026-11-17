'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, m } from 'framer-motion';
import { LocateFixed, Search } from 'lucide-react';
import type { Restaurant } from '../../data/mockRestaurants';
import type { LocateFailure, LocateResult, MapStatus, MapViewHandle } from './MapView';
import { PlaceSheet } from './PlaceSheet';
import {
  LatLng, SEARCH_RADIUS, Scope, hasMovedFar, mergePlaces, nearbyUrl, scopePlaces,
} from './mapData';
import { Sticker } from '../ui/Sticker';
import { DetailSheet } from '../swipe/DetailSheet';
import { readReported, subscribeReports } from '../../lib/reports';
import { readLikes, subscribeLikes, toggleLike } from '../../lib/likes';
import { FamilyId, filterByFamily, familyLabel } from '../../lib/favoriteTypes';

// MapLibre (~800 Ko) ne part qu'avec cet écran, et après son premier rendu.
const MapView = dynamic(() => import('./MapView').then(m => m.MapView), { ssr: false });

const TOULOUSE: LatLng = { lat: 43.6047, lng: 1.4442 };
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'liked', label: 'Coups de cœur' },
];
const LOCATE_MESSAGES: Record<LocateFailure, string> = {
  denied: 'Localisation refusée : autorise-la dans les réglages du navigateur.',
  unsupported: 'La localisation n’est pas disponible sur cet appareil.',
  timeout: 'La position met trop de temps à arriver. Réessaie.',
  unavailable: 'Position indisponible pour le moment.',
  'not-ready': 'La carte n’est pas encore prête.',
};
const NOTICE_MS = 4000;

type FetchState = 'idle' | 'loading' | 'error';

/** Carte des envies : les coups de cœur (et, au choix, tous les restos autour) sur la carte. Vit dans Favoris. */
export function MapScreen({ initialScope = 'liked', family = null }: { initialScope?: Scope; family?: FamilyId | null }) {
  const handleRef = useRef<MapViewHandle | null>(null);
  const [likes, setLikes] = useState<Restaurant[]>([]);
  const [fetched, setFetched] = useState<Restaurant[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [mapKey, setMapKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Restaurant | null>(null);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSearch, setNeedsSearch] = useState(false);
  const centerRef = useRef<LatLng>(TOULOUSE);
  const searchedRef = useRef<LatLng | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Les coups de cœur viennent de lib/likes : même source que Favoris, Profil et la barre d'onglets.
  useEffect(() => {
    const sync = () => setLikes(readLikes());
    sync();
    return subscribeLikes(sync);
  }, []);

  const searchAround = useCallback(async (at: LatLng) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    searchedRef.current = at;
    setNeedsSearch(false);
    setFetchState('loading');
    try {
      const res = await fetch(nearbyUrl(at, SEARCH_RADIUS), { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: unknown };
      if (!Array.isArray(body.data)) throw new Error('format');
      setFetched(prev => mergePlaces(body.data as Restaurant[], prev));
      setFetchState('idle');
    } catch {
      if (ctrl.signal.aborted) return;
      searchedRef.current = null;
      setFetchState('error');
    }
  }, []);

  // Les restos autour ne se chargent que si on les demande (vue « Tous ») : la carte des envies reste légère.
  useEffect(() => {
    if (scope === 'all' && !searchedRef.current) void searchAround(TOULOUSE);
  }, [scope, searchAround]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Message temporaire : le minuteur est annulé au démontage et à chaque nouveau message.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const likedIds = useMemo(() => new Set(likes.map(r => r.id)), [likes]);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  useEffect(() => { const sync = () => setReported(readReported()); sync(); return subscribeReports(sync); }, []);
  const places = useMemo(() => mergePlaces(likes, fetched.filter(r => !reported.has(r.id))), [likes, fetched, reported]);
  // Filtre par type : il s'applique aux repères affichés (coups de cœur et, en vue « Tous », restos autour).
  const shown = useMemo(() => filterByFamily(scopePlaces(places, scope, likedIds), family), [places, scope, likedIds, family]);
  const selected = useMemo(() => shown.find(r => r.id === selectedId) ?? null, [shown, selectedId]);

  const handleToggleLike = (rest: Restaurant) => {
    toggleLike(rest);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
  };

  const handleLocate = async () => {
    if (locating) return;
    setLocating(true);
    const result = await (handleRef.current?.locate() ?? Promise.resolve<LocateResult>({ ok: false, reason: 'not-ready' }));
    setLocating(false);
    if ('reason' in result) setNotice(LOCATE_MESSAGES[result.reason]);
    else void searchAround(result.at);
  };

  const handleMoveEnd = useCallback((center: LatLng) => {
    centerRef.current = center;
    setNeedsSearch(hasMovedFar(searchedRef.current, center));
  }, []);

  const retryMap = () => {
    setMapStatus('loading');
    setMapKey(k => k + 1);
  };

  const noLikes = likes.length === 0;
  const showEmptyLiked = scope === 'liked' && shown.length === 0 && mapStatus !== 'error';

  return (
    <div className='h-full min-h-0 flex flex-col'>
      <div className='flex-1 relative min-h-0 overflow-hidden bg-cream'>
        <MapView
          key={mapKey}
          places={shown}
          likedIds={likedIds}
          selectedId={selected?.id ?? null}
          fitKey={`${scope}:${family ?? ''}`}
          onSelect={setSelectedId}
          onStatus={setMapStatus}
          onMoveEnd={handleMoveEnd}
          onReady={h => { handleRef.current = h; }}
        />

        <div className='absolute top-3 inset-x-0 z-10 flex justify-start px-3 pointer-events-none'>
          <div role='tablist' aria-label='Repères affichés' className='pointer-events-auto relative grid grid-cols-2 bg-white p-1 rounded-full border-[3px] border-plum shadow-hard'>
            {SCOPES.map(s => (
              <button
                key={s.id}
                role='tab'
                aria-selected={scope === s.id}
                onClick={() => setScope(s.id)}
                className={`relative z-10 px-3 min-[360px]:px-4 min-h-[40px] rounded-full text-xs font-bold whitespace-nowrap transition-colors ${scope === s.id ? 'text-plum' : 'text-slate-muted'}`}
              >
                {scope === s.id && (
                  <m.span
                    layoutId='map-scope-pill'
                    className='absolute inset-0 rounded-full bg-fooder-secondary -z-10'
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleLocate}
          disabled={locating}
          aria-label='Me localiser'
          className='absolute top-3 right-3 z-10 w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
        >
          <LocateFixed className={`w-5 h-5 text-plum ${locating ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
        </button>

        <div className='absolute top-[68px] inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pointer-events-none'>
          {mapStatus === 'ready' && scope === 'all' && needsSearch && fetchState !== 'loading' && (
            <button
              onClick={() => void searchAround(centerRef.current)}
              className='pointer-events-auto chip min-h-[44px] bg-white text-plum shadow-hard active:translate-y-0.5 transition-transform'
            >
              <Search className='w-4 h-4' aria-hidden='true' /> Chercher ici
            </button>
          )}
          <div role='status' aria-live='polite' className='flex flex-col items-center gap-2'>
            {fetchState === 'loading' && mapStatus === 'ready' && (
              <span className='chip bg-white text-plum text-xs'>Recherche des restos autour…</span>
            )}
            {fetchState === 'error' && (
              <button
                onClick={() => void searchAround(centerRef.current)}
                className='pointer-events-auto chip min-h-[44px] bg-white text-danger text-xs text-center'
              >
                Restos autour indisponibles, tes coups de cœur restent affichés. Réessayer
              </button>
            )}
            {notice && <span className='chip bg-lemon text-plum text-xs text-center'>{notice}</span>}
          </div>
        </div>

        <AnimatePresence>
          {mapStatus === 'loading' && (
            <m.div
              key='map-loading'
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-cream'
              role='status'
            >
              <Sticker name='plate' size={72} rotate={-6} className='bob' />
              <p className='font-display text-xl text-plum'>Chargement de la carte…</p>
            </m.div>
          )}
        </AnimatePresence>

        {mapStatus === 'error' && (
          <div className='absolute inset-x-6 top-1/3 z-10 bg-white rounded-3xl p-5 panel text-center space-y-3 flex flex-col items-center'>
            <p className='font-display text-2xl text-plum'>Carte indisponible</p>
            <p className='text-slate-muted text-sm font-medium'>Impossible de charger les tuiles. Vérifie ta connexion puis réessaie.</p>
            <button onClick={retryMap} className='duo-button bg-fooder-primary text-white px-8 min-h-[44px]'>Réessayer</button>
          </div>
        )}

        <AnimatePresence>
          {showEmptyLiked && mapStatus === 'ready' && (
            <m.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className='absolute inset-x-6 top-1/3 z-10 bg-white rounded-3xl p-5 panel text-center space-y-2 flex flex-col items-center'
            >
              <Sticker name='b_heart' size={64} rotate={-6} className='bob' />
              <p className='font-display text-2xl text-plum'>{noLikes ? 'Aucun coup de cœur' : 'Coups de cœur sans position'}</p>
              <p className='text-slate-muted text-sm font-medium'>
                {noLikes
                  ? 'Swipe à droite pour voir tes restos s’afficher ici.'
                  : family
                    ? `Aucun coup de cœur « ${familyLabel(family)} » n’a de coordonnées : ils restent dans ta liste de Favoris.`
                    : 'Tes favoris n’ont pas de coordonnées : ils restent dans ta liste de Favoris.'}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <PlaceSheet
        rest={selected}
        liked={selected ? likedIds.has(selected.id) : false}
        onClose={() => setSelectedId(null)}
        onOpenDetail={setDetail}
        onToggleLike={handleToggleLike}
      />
      <DetailSheet rest={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
