import { Star, MapPin, Zap, ChevronRight } from 'lucide-react';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { stickerFor } from '../../lib/stickers';

interface RestaurantCardProps {
  rest: Restaurant;
}

export function RestaurantCard({ rest }: RestaurantCardProps) {
  const sticker = stickerFor(rest.cuisine, rest.id, rest.name);

  return (
    <div className='relative w-full h-full bg-white rounded-[28px] overflow-hidden border-[3px] border-plum shadow-hard-lg flex flex-col'>
      <div className='relative w-full h-[56%] shrink-0 border-b-[3px] border-plum'>
        <FoodImage src={rest.image} alt={rest.name} cuisine={rest.cuisine} className='w-full h-full object-cover' />
        <div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-plum/50 to-transparent' />

        {rest.sponsored && (
          <div className='chip absolute top-3 left-3 bg-fooder-secondary text-plum'>
            <Zap className='w-3 h-3 fill-plum' />
            {rest.sponsorLabel || 'Sponsorisé'}
          </div>
        )}

        <div className='chip absolute top-3 right-3 bg-white text-plum text-xs'>
          <Star className='w-3.5 h-3.5 text-fooder-orange fill-fooder-orange' />
          {rest.rating}
        </div>

        <div className='absolute -bottom-7 right-3 z-10 bob' style={{ ['--r' as string]: '-8deg' }}>
          <Sticker name={sticker} size={84} rotate={-8} />
        </div>
      </div>

      <div className='flex-1 min-h-0 flex flex-col px-5 pt-4 pb-3.5'>
        <h2 className='text-[26px] leading-[1.05] text-plum pr-16 line-clamp-2'>{rest.name}</h2>

        <div className='flex flex-wrap gap-2 mt-2.5'>
          <span className='chip bg-fooder-secondary text-plum'>{rest.price}€</span>
          <span className='chip bg-fooder-mint text-plum'>
            <MapPin className='w-3 h-3' />
            {rest.distance}
          </span>
          <span className='chip bg-fooder-primary text-white'>{rest.cuisine}</span>
        </div>

        <p className='text-slate-600 text-sm font-medium line-clamp-2 leading-snug mt-2.5'>
          {rest.description || "Un établissement d'exception vous attend à Toulouse pour une dégustation mémorable."}
        </p>

        <div className='mt-auto pt-2 flex items-center justify-between text-xs font-bold text-plum/70 border-t-2 border-dashed border-plum/15'>
          <span>Touche pour voir le menu</span>
          <ChevronRight className='w-4 h-4' strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}
