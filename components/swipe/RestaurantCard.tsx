'use client';
import { Star, MapPin, Zap, Camera } from 'lucide-react';
import { motion, MotionValue, useMotionValue, useTransform } from 'framer-motion';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { stickerFor } from '../../lib/stickers';
import { isOpenAt } from '../../lib/openingHours';
import { cardSummary } from './cardSummary';
import { DIET_LABEL, DIET_SHORT_LABEL, DIET_SOURCE_NOTE, badgeDiets } from '../../lib/diets';

interface RestaurantCardProps {
  rest: Restaurant;
  hold?: MotionValue<number>;
  /** Masque l'invitation « Touche pour ouvrir » (deck de groupe sans fiche) */
  hideHint?: boolean;
}

function HoldHint({ hold }: { hold?: MotionValue<number> }) {
  const idle = useMotionValue(0);
  const progress = hold ?? idle;
  const width = useTransform(progress, v => `${v * 100}%`);

  return (
    <div className='relative mt-auto h-9 rounded-full border-[3px] border-plum bg-cream overflow-hidden flex items-center justify-center'>
      <motion.div className='absolute inset-y-0 left-0 bg-fooder-secondary' style={{ width }} />
      <span className='relative text-xs font-bold text-plum'>Touche pour ouvrir</span>
    </div>
  );
}

export function RestaurantCard({ rest, hold, hideHint }: RestaurantCardProps) {
  const sticker = stickerFor(rest.cuisine, rest.id, rest.name);
  const now = new Date();
  const closed = isOpenAt(rest.hours, now) === false;
  const summary = cardSummary(rest, now);

  return (
    <div className='rcard relative w-full h-full bg-white rounded-[28px] overflow-hidden border-[3px] border-plum shadow-hard-lg flex flex-col'>
      <div className='rcard-photo relative w-full h-[44%] shrink-0 border-b-[3px] border-plum'>
        <FoodImage src={rest.image} alt={rest.name} cuisine={rest.cuisine} className='w-full h-full object-cover' />
        {rest.image && <div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-plum/50 to-transparent' />}

        {rest.sponsored && (
          <div className='chip absolute top-3 left-3 bg-fooder-secondary text-plum'>
            <Zap className='w-3 h-3 fill-plum' />
            {rest.sponsorLabel || 'Sponsorisé'}
          </div>
        )}

        {rest.rating > 0 && (
          <div className='chip absolute top-3 right-3 bg-white text-plum text-xs'>
            <Star className='w-3.5 h-3.5 text-fooder-orange fill-fooder-orange' />
            {rest.rating}
          </div>
        )}

        {closed && (
          <div className={`chip absolute left-3 bg-white text-plum text-xs ${rest.sponsored ? 'top-12' : 'top-3'}`}>
            <span className='w-2 h-2 rounded-full border-[1.5px] border-plum bg-fooder-red' />
            Fermé
          </div>
        )}

        {rest.photoSource === 'dish' ? (
          <div className='absolute bottom-2 left-3 z-10 max-w-[72%] chip !text-[10px] !px-2 !py-0.5 bg-white/90 text-plum'>
            <Camera className='w-3 h-3 shrink-0' strokeWidth={2.5} />
            <span className='truncate'>Plat typique{rest.photoCredit ? ` · ${rest.photoCredit}` : ''}</span>
          </div>
        ) : rest.photoSource === 'site' || rest.photoSource === 'restaurant' ? (
          <div className='absolute bottom-2 left-3 z-10 max-w-[72%] chip !text-[10px] !px-2 !py-0.5 bg-white/90 text-plum'>
            <Camera className='w-3 h-3 shrink-0' strokeWidth={2.5} />
            <span className='truncate'>Photo du restaurant</span>
          </div>
        ) : rest.photoSource !== 'community' ? (
          <div className='absolute bottom-2 left-3 z-10 chip !text-[10px] !px-2 !py-0.5 bg-white/90 text-plum'>
            <Camera className='w-3 h-3' strokeWidth={2.5} />
            Illustration · vraie photo à venir
          </div>
        ) : null}

        {rest.image && (
          <div className='absolute -bottom-7 right-3 z-10 bob' style={{ ['--r' as string]: '-8deg' }}>
            <Sticker name={sticker} size={84} rotate={-8} />
          </div>
        )}
      </div>

      <div className='flex-1 min-h-0 flex flex-col px-5 pt-4 pb-3.5'>
        <h2 className='rcard-name leading-[1.05] text-plum pr-16 line-clamp-2'>{rest.name}</h2>

        <div className='rcard-chips flex flex-wrap gap-2 mt-2.5'>
          {rest.price > 0 && <span className='chip bg-fooder-secondary text-plum'>{rest.price}€</span>}
          <span className='chip bg-fooder-mint text-plum'>
            <MapPin className='w-3 h-3' />
            {rest.distance}
          </span>
          <span className='chip bg-fooder-primary text-white'>{rest.cuisine}</span>
          {badgeDiets(rest).map(d => (
            <span key={d} className='chip !text-[11px] !px-2 !py-0.5 bg-white text-plum' title={`${DIET_LABEL[d]} (${DIET_SOURCE_NOTE})`}>
              {DIET_SHORT_LABEL[d]}
            </span>
          ))}
        </div>

        {summary && <p className='mt-2 text-[13px] font-bold text-plum leading-snug'>{summary}</p>}

        <p className='rcard-desc text-slate-600 text-sm font-medium line-clamp-3 leading-snug mt-2.5'>
          {rest.description}
        </p>

        {!hideHint && <HoldHint hold={hold} />}
      </div>
    </div>
  );
}
