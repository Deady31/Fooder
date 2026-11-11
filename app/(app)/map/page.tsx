'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, LocateFixed, Navigation, Star } from 'lucide-react';
import { mockRestaurants, Restaurant } from '../../../data/mockRestaurants';
import { PageHeader } from '../../../components/nav/PageHeader';
import { MapView, MapViewHandle } from '../../../components/map/MapView';
import { FoodImage } from '../../../components/ui/FoodImage';
import { Sticker } from '../../../components/ui/Sticker';
import { DetailSheet } from '../../../components/swipe/DetailSheet';
import { readLikes, toggleLike } from '../../../lib/likes';
import { stickerFor } from '../../../lib/stickers';

type Scope = 'all' | 'liked';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'liked', label: 'Coups de cœur' },
];

export default function MapPage() {
  const mapRef = useRef<MapViewHandle>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Restaurant | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  const restaurants = useMemo(() => mockRestaurants.filter(r => typeof r.lat === 'number'), []);

  useEffect(() => {
    setLikedIds(new Set(readLikes().map(r => r.id)));
  }, []);

  const visibleIds = useMemo(() => (scope === 'liked' ? likedIds : null), [scope, likedIds]);
  const selected = restaurants.find(r => r.id === selectedId) || null;
  const shownCount = scope === 'liked' ? restaurants.filter(r => likedIds.has(r.id)).length : restaurants.length;

  useEffect(() => {
    if (selectedId && visibleIds && !visibleIds.has(selectedId)) setSelectedId(null);
  }, [visibleIds, selectedId]);

  const handleToggleLike = (rest: Restaurant) => {
    const nowLiked = toggleLike(rest);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (nowLiked) next.add(rest.id);
      else next.delete(rest.id);
      return next;
    });
    if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(30);
  };

  const handleLocate = async () => {
    setLocating(true);
    setLocateFailed(false);
    const ok = await mapRef.current?.locate();
    setLocating(false);
    if (!ok) setLocateFailed(true);
  };

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Carte'
        subtitle={`${shownCount} spot${shownCount > 1 ? 's' : ''} à Toulouse`}
        right={
          <button
            onClick={handleLocate}
            aria-label='Me localiser'
            className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <LocateFixed className={`w-5 h-5 text-plum ${locating ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
          </button>
        }
      />

      <div className='flex-1 relative min-h-0 overflow-hidden'>
        <MapView
          ref={mapRef}
          restaurants={restaurants}
          likedIds={likedIds}
          selectedId={selectedId}
          visibleIds={visibleIds}
          onSelect={setSelectedId}
        />

        <div className='absolute top-3 inset-x-0 z-10 flex justify-center pointer-events-none'>
          <div className='pointer-events-auto relative grid grid-cols-2 bg-white p-1 rounded-full border-[3px] border-plum shadow-hard'>
            {SCOPES.map(s => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${scope === s.id ? 'text-plum' : 'text-slate-500'}`}
              >
                {scope === s.id && (
                  <motion.span
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

        <AnimatePresence>
          {scope === 'liked' && shownCount === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className='absolute inset-x-6 top-1/3 z-10 bg-white rounded-3xl p-5 panel text-center space-y-2 flex flex-col items-center'
            >
              <Sticker name='b_heart' size={64} rotate={-6} className='bob' />
              <p className='font-display text-2xl text-plum'>Aucun coup de cœur</p>
              <p className='text-slate-600 text-sm font-medium'>Swipe à droite pour voir tes restos s&apos;afficher ici.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {locateFailed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onAnimationComplete={() => setTimeout(() => setLocateFailed(false), 2600)}
              className='absolute top-16 inset-x-0 mx-auto w-fit z-10 chip bg-fooder-red text-white whitespace-nowrap'
            >
              Position indisponible
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ y: 140, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 140, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className='absolute bottom-3 inset-x-3 z-10 bg-white rounded-3xl p-3 panel flex gap-3'
            >
              <button
                onClick={() => setDetail(selected)}
                aria-label={`Voir ${selected.name}`}
                className='relative w-[84px] h-[84px] rounded-2xl overflow-hidden border-[3px] border-plum shrink-0'
              >
                <FoodImage src={selected.image} alt={selected.name} cuisine={selected.cuisine} className='w-full h-full object-cover' />
              </button>

              <div className='flex-1 min-w-0 flex flex-col justify-between'>
                <div>
                  <div className='flex items-start justify-between gap-2'>
                    <h3 className='text-xl text-plum leading-tight line-clamp-2'>{selected.name}</h3>
                    <Sticker name={stickerFor(selected.cuisine, selected.id, selected.name)} size={34} rotate={8} className='shrink-0' />
                  </div>
                  <div className='flex items-center gap-1.5 text-xs font-bold text-slate-600 mt-0.5'>
                    <Star className='w-3 h-3 fill-fooder-orange text-fooder-orange' />
                    <span>{selected.rating}</span>
                    <span className='text-slate-300'>•</span>
                    <span className='truncate'>{selected.cuisine}</span>
                    <span className='text-slate-300'>•</span>
                    <span>{selected.price}€</span>
                  </div>
                </div>

                <div className='flex gap-1.5 mt-2'>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name} ${selected.address}`)}`, '_blank')}
                    className='chip flex-1 justify-center whitespace-nowrap !px-2 bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
                  >
                    <Navigation className='w-3 h-3' /> Y aller
                  </button>
                  <button
                    onClick={() => setDetail(selected)}
                    className='chip justify-center !px-3 bg-white text-plum active:translate-y-0.5 transition-transform'
                  >
                    Fiche
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.82 }}
                    onClick={() => handleToggleLike(selected)}
                    aria-label={likedIds.has(selected.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    aria-pressed={likedIds.has(selected.id)}
                    className={`chip justify-center !px-2.5 ${likedIds.has(selected.id) ? 'bg-bubblegum' : 'bg-white'} text-plum transition-colors`}
                  >
                    <Heart className={`w-4 h-4 ${likedIds.has(selected.id) ? 'fill-plum' : ''}`} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DetailSheet rest={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
