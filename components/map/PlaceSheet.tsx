'use client';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Heart, Navigation, Star } from 'lucide-react';
import type { Restaurant } from '../../data/mockRestaurants';
import { FoodImage } from '../ui/FoodImage';
import { Sheet } from '../ui/Sheet';
import { Sticker } from '../ui/Sticker';
import { stickerFor } from '../../lib/stickers';

interface PlaceSheetProps {
  /** Resto affiché ; null ferme la feuille (le contenu reste le temps de l'animation de sortie). */
  rest: Restaurant | null;
  liked: boolean;
  onClose: () => void;
  onOpenDetail: (rest: Restaurant) => void;
  onToggleLike: (rest: Restaurant) => void;
}

const TITLE_ID = 'map-place-title';

/** Fiche rapide d'un repère de la carte. La fiche complète (photos, horaires) s'ouvre par « Fiche ». */
export function PlaceSheet({ rest, liked, onClose, onOpenDetail, onToggleLike }: PlaceSheetProps) {
  const kept = useRef<Restaurant | null>(null);
  if (rest) kept.current = rest;
  const shown = rest ?? kept.current;
  // Sous la fiche complète (z-150) pour qu'elle puisse s'ouvrir par-dessus.
  return (
    <Sheet
      open={Boolean(rest)}
      onClose={onClose}
      labelledBy={TITLE_ID}
      zIndex={140}
      className='bg-white rounded-3xl border-[3px] border-plum shadow-hard p-3.5'
    >
      {shown && (
        <div className='flex gap-3'>
          <button
            onClick={() => onOpenDetail(shown)}
            aria-label={`Voir la fiche de ${shown.name}`}
            className='relative w-[88px] h-[88px] rounded-2xl overflow-hidden border-[3px] border-plum shrink-0'
          >
            <FoodImage src={shown.image} alt='' cuisine={shown.cuisine} className='w-full h-full object-cover' />
          </button>

          <div className='flex-1 min-w-0 flex flex-col justify-between gap-2'>
            <div>
              <div className='flex items-start justify-between gap-2'>
                <h2 id={TITLE_ID} className='text-xl text-plum leading-tight line-clamp-2'>{shown.name}</h2>
                <Sticker name={stickerFor(shown.cuisine, shown.id, shown.name)} size={34} rotate={8} className='shrink-0' />
              </div>
              <div className='flex items-center gap-1.5 text-xs font-bold text-slate-muted mt-0.5 min-w-0'>
                {shown.rating > 0 && (
                  <>
                    <Star className='w-3 h-3 fill-fooder-orange text-fooder-orange shrink-0' aria-hidden='true' />
                    <span>{shown.rating}</span>
                    <span aria-hidden='true'>•</span>
                  </>
                )}
                <span className='truncate'>{shown.cuisine}</span>
                {shown.price > 0 && (
                  <>
                    <span aria-hidden='true'>•</span>
                    <span>{shown.price}€</span>
                  </>
                )}
              </div>
              {shown.address && <p className='text-xs font-medium text-slate-muted mt-0.5 line-clamp-1'>{shown.address}</p>}
            </div>

            <div className='flex gap-1.5'>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shown.name} ${shown.address}`)}`}
                target='_blank'
                rel='noopener noreferrer'
                className='chip flex-1 justify-center whitespace-nowrap !px-2 min-h-[44px] bg-fooder-secondary text-plum active:translate-y-0.5 transition-transform'
              >
                <Navigation className='w-3.5 h-3.5' aria-hidden='true' /> Y aller
              </a>
              <button
                onClick={() => onOpenDetail(shown)}
                className='chip justify-center !px-3 min-h-[44px] bg-white text-plum active:translate-y-0.5 transition-transform'
              >
                Fiche
              </button>
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={() => onToggleLike(shown)}
                aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                aria-pressed={liked}
                className={`chip justify-center !px-3 min-h-[44px] min-w-[44px] ${liked ? 'bg-bubblegum' : 'bg-white'} text-plum transition-colors`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-plum' : ''}`} aria-hidden='true' />
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
