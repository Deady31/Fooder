import { FOOD_STICKERS, FoodSticker, stickerFor, stickerSrc } from '../../lib/stickers';

const TINTS: Partial<Record<FoodSticker, string>> = {
  pizza: '#FFC857', burger: '#FFA75E', ramen: '#FFD83D', sushi: '#FF9AA2', taco: '#B8F2A0', kebab: '#FFB86B',
  croissant: '#FFE08A', fries: '#FFEE8F', donut: '#FF9AD5', icecream: '#A8E6FF', salad: '#A6F0B5', curry: '#FFB347',
  coffee: '#E8C9A0', wine: '#D8B4FF', pasta: '#FFD6A5', boba: '#FFB3E6', cupcake: '#FFC2E2', plate: '#CDB8FF',
  dumpling: '#FFE9B0', steak: '#FF9F8A', hotdog: '#FFC27A', croque: '#FFDD8A', brunch: '#FFE08A',
};

const SATELLITES = [
  { left: '9%', top: '14%', rotate: -14 },
  { right: '9%', top: '18%', rotate: 12 },
  { left: '14%', bottom: '10%', rotate: 10 },
  { right: '12%', bottom: '8%', rotate: -10 },
] as const;

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

interface CoverArtProps {
  name: string;
  cuisine: string;
  className?: string;
}

/** Couverture illustrée pour les restaurants sans photo : une vraie composition, pas un placeholder. */
export function CoverArt({ name, cuisine, className = '' }: CoverArtProps) {
  const main = stickerFor(cuisine, name, name);
  const seed = hash(name);
  const companions = FOOD_STICKERS.filter(s => s !== main);

  return (
    <div
      role='img'
      aria-label={name}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{
        backgroundColor: TINTS[main] ?? '#FFD6A5',
        backgroundImage: 'radial-gradient(rgba(43,15,58,0.14) 1.6px, transparent 1.8px)',
        backgroundSize: '16px 16px',
      }}
    >
      {SATELLITES.map((pos, i) => {
        const s = companions[(seed + i * 5) % companions.length];
        const { rotate, ...place } = pos;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={stickerSrc(s)}
            alt=''
            draggable={false}
            className='absolute h-[26%] aspect-square object-contain opacity-90 pointer-events-none'
            style={{ ...place, transform: `rotate(${rotate}deg)` }}
          />
        );
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stickerSrc(main)} alt='' draggable={false} className='relative h-[72%] aspect-square object-contain bob' style={{ ['--r' as string]: '-6deg' }} />
    </div>
  );
}
