'use client';
import { Star, MapPin, Zap, Camera, Clock } from 'lucide-react';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { FoodImage } from '../ui/FoodImage';
import { stickerFor } from '../../lib/stickers';
import { closesAt, formatCloseTime, openStatus, parisWallClock } from '../../lib/openingHours';
import { cardSummary } from './cardSummary';
import { DIET_LABEL, DIET_SHORT_LABEL, DIET_SOURCE_NOTE, badgeDiets } from '../../lib/diets';
import { restaurantPlaceLine } from '../../lib/geo/format';
import type { Diet } from '../../data/mockRestaurants';

interface RestaurantCardProps {
  rest: Restaurant;
}

/** Au plus 2 badges de régime sur la carte ; le reste en « +N ». */
const MAX_DIET_BADGES = 2;

function PhotoCredit({ rest }: { rest: Restaurant }) {
  const base = 'rcard-credit absolute bottom-2 left-3 z-10 max-w-[68%] chip !text-[10px] !px-2 !py-0.5 bg-white/90 text-plum';
  if (rest.photoSource === 'dish') {
    return (
      <div className={base}>
        <Camera className='w-3 h-3 shrink-0' strokeWidth={2.5} />
        <span className='truncate'>Plat typique{rest.photoCredit ? ` · ${rest.photoCredit}` : ''}</span>
      </div>
    );
  }
  if (rest.photoSource === 'site' || rest.photoSource === 'restaurant') {
    return (
      <div className={base}>
        <Camera className='w-3 h-3 shrink-0' strokeWidth={2.5} />
        <span className='truncate'>Photo du restaurant</span>
      </div>
    );
  }
  if (rest.photoSource === 'community') return null;
  return (
    <div className={base}>
      <Camera className='w-3 h-3 shrink-0' strokeWidth={2.5} />
      <span className='truncate'>Illustration · photo à venir</span>
    </div>
  );
}

/** Badge d'horaires : « Ferme à 22 h » (< 30 min) ou « Horaires non renseignés » ; rien si ouvert ou fermé. */
function HoursBadge({ rest, wall }: { rest: Restaurant; wall: Date }) {
  const status = openStatus(rest.hours, wall);
  if (status === 'unknown') {
    return (
      <div className='chip !text-[10px] !px-2 !py-0.5 bg-white text-plum max-w-full'>
        <Clock className='w-3 h-3 shrink-0' strokeWidth={2.5} aria-hidden='true' />
        <span className='truncate'>Horaires non renseignés</span>
      </div>
    );
  }
  if (status === 'closing-soon') {
    const close = closesAt(rest.hours, wall);
    return (
      <div className='chip !text-[11px] !px-2 !py-0.5 bg-fooder-orange text-plum max-w-full'>
        <Clock className='w-3 h-3 shrink-0' strokeWidth={2.5} aria-hidden='true' />
        <span className='truncate'>{close ? `Ferme à ${formatCloseTime(close)}` : 'Ferme bientôt'}</span>
      </div>
    );
  }
  return null;
}

function Badges({ rest }: { rest: Restaurant }) {
  const diets: Diet[] = badgeDiets(rest);
  const shown = diets.slice(0, MAX_DIET_BADGES);
  const extra = diets.length - shown.length;
  return (
    // 2 lignes au maximum : le surplus est coupé, jamais une 3e ligne.
    <div className='rcard-chips flex flex-wrap gap-1.5 mt-2 max-h-[62px] overflow-hidden shrink-0 min-w-0'>
      {rest.price > 0 && <span className='chip shrink-0 bg-fooder-secondary text-plum'>{rest.price}€</span>}
      <span className='chip min-w-0 max-w-full bg-fooder-primary text-white'><span className='truncate'>{rest.cuisine}</span></span>
      {shown.map(d => (
        <span key={d} className='chip shrink-0 !text-[11px] !px-2 !py-0.5 bg-white text-plum' title={`${DIET_LABEL[d]} (${DIET_SOURCE_NOTE})`}>
          {DIET_SHORT_LABEL[d]}
        </span>
      ))}
      {extra > 0 && (
        <span className='chip shrink-0 !text-[11px] !px-2 !py-0.5 bg-white text-plum' title={diets.slice(MAX_DIET_BADGES).map(d => DIET_LABEL[d]).join(', ')}>
          +{extra}
        </span>
      )}
    </div>
  );
}

export function RestaurantCard({ rest }: RestaurantCardProps) {
  const sticker = stickerFor(rest.cuisine, rest.id, rest.name);
  const wall = parisWallClock(new Date());
  const summary = cardSummary(rest, wall);

  return (
    <div className='rcard relative w-full h-full bg-white rounded-[28px] overflow-hidden border-[3px] border-plum shadow-hard-lg'>
      {/* Un conteneur de requêtes ne peut pas se styler lui-même : la mise en page (colonne / paysage) est sur .rcard-in. */}
      <div className='rcard-in w-full h-full flex flex-col'>
      <div className='rcard-photo relative shrink-0 border-plum'>
        <FoodImage src={rest.image} alt={rest.name} cuisine={rest.cuisine} className='w-full h-full object-cover' />
        {rest.image && <div className='absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-plum/50 to-transparent' />}

        <div className='rcard-flags absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-5.5rem)]'>
          {rest.sponsored && (
            <div className='chip bg-fooder-secondary text-plum max-w-full'>
              <Zap className='w-3 h-3 shrink-0 fill-plum' />
              <span className='truncate'>{rest.sponsorLabel || 'Sponsorisé'}</span>
            </div>
          )}
          <HoursBadge rest={rest} wall={wall} />
        </div>

        {rest.rating > 0 && (
          <div className='rcard-rating chip absolute top-3 right-3 z-10 bg-white text-plum text-xs'>
            <Star className='w-3.5 h-3.5 text-fooder-orange fill-fooder-orange' />
            {rest.rating}
          </div>
        )}

        <PhotoCredit rest={rest} />

        {rest.image && (
          <div className='rcard-sticker absolute z-10 bob' style={{ ['--r' as string]: '-8deg' }}>
            <Sticker name={sticker} size={72} rotate={-8} />
          </div>
        )}
      </div>

      <div className='rcard-body flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden px-5 pt-4 pb-3.5'>
        <h2 className='rcard-name shrink-0 text-plum line-clamp-2 pb-[0.08em]'>{rest.name}</h2>

        {/* Adresse de rue (repli quartier) et distance réelle depuis la position choisie. */}
        <p className='rcard-place shrink-0 mt-1.5 flex items-center gap-1 min-w-0 text-[13px] font-bold text-plum'>
          <MapPin className='w-3.5 h-3.5 shrink-0' strokeWidth={2.5} aria-hidden='true' />
          <span className='truncate'>{restaurantPlaceLine(rest)}</span>
          {rest.distance && <span className='shrink-0 rounded-full bg-fooder-mint border-2 border-plum px-1.5 text-[11px] leading-[18px]'>{rest.distance}</span>}
        </p>

        <Badges rest={rest} />

        {summary && <p className='rcard-summary shrink-0 mt-2 text-[13px] font-bold text-plum leading-snug line-clamp-2'>{summary}</p>}

        <p className='rcard-desc text-slate-600 text-sm font-medium leading-snug mt-2.5'>
          {rest.description}
        </p>
      </div>
      </div>
    </div>
  );
}
