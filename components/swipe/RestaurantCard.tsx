'use client';
import { Star, MapPin, Zap, Camera } from 'lucide-react';
import { motion, MotionValue, useMotionValue, useTransform } from 'framer-motion';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { stickerFor } from '../../lib/stickers';
import { openStatus } from '../../lib/hours';

interface RestaurantCardProps {
  rest: Restaurant;
  hold?: MotionValue<number>;
  nudge?: number;
}

function HoldHint({ hold, nudge = 0 }: { hold?: MotionValue<number>; nudge?: number }) {
  const idle = useMotionValue(0);
  const progress = hold ?? idle;
  const width = useTransform(progress, v => `${v * 100}%`);

  return (
    <div className='relative mt-auto h-9 rounded-full border-[3px] border-plum bg-cream overflow-hidden flex items-center justify-center'>
      <motion.div className='absolute inset-y-0 left-0 bg-fooder-secondary' style={{ width }} />
      <motion.span
        key={nudge}
        className='relative text-xs font-bold text-plum'
        animate={nudge > 0 ? { x: [0, -7, 7, -5, 5, 0] } : undefined}
        transition={{ duration: 0.38 }}
      >
        Maintiens appuyé pour ouvrir la fiche
      </motion.span>
    </div>
  );
}

export function RestaurantCard({ rest, hold, nudge }: RestaurantCardProps) {
  const sticker = stickerFor(rest.cuisine, rest.id, rest.name);
  const status = rest.hours ? openStatus(rest.hours) : null;

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

        {rest.rating > 0 ? (
          <div className='chip absolute top-3 right-3 bg-white text-plum text-xs'>
            <Star className='w-3.5 h-3.5 text-fooder-orange fill-fooder-orange' />
            {rest.rating}
          </div>
        ) : (
          status && (
            <div className={`chip absolute top-3 right-3 text-plum text-xs ${status.open ? 'bg-fooder-mint' : 'bg-white'}`}>
              <span className={`w-2 h-2 rounded-full border-[1.5px] border-plum ${status.open ? 'bg-white' : 'bg-fooder-red'}`} />
              {status.open ? 'Ouvert' : 'Fermé'}
            </div>
          )
        )}

        {rest.photoSource !== 'community' && (
          <div className='absolute bottom-2 left-3 z-10 chip !text-[10px] !px-2 !py-0.5 bg-white/90 text-plum'>
            <Camera className='w-3 h-3' strokeWidth={2.5} />
            Illustration · vraie photo à venir
          </div>
        )}

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
          {status && <span className='chip bg-white text-plum'>{status.label.replace(/^(Ouvert|Fermé) · /, '')}</span>}
        </div>

        <p className='rcard-desc text-slate-600 text-sm font-medium line-clamp-3 leading-snug mt-2.5'>
          {rest.description}
        </p>

        <HoldHint hold={hold} nudge={nudge} />
      </div>
    </div>
  );
}
