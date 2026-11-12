import { FoodSticker, satellitesFor, stickerFor, stickerSrc } from '../../lib/stickers';

const TINTS: Partial<Record<FoodSticker, string>> = {
  pizza: '#FFC857', burger: '#FFA75E', ramen: '#FFD83D', sushi: '#FF9AA2', taco: '#B8F2A0', kebab: '#FFB86B',
  croissant: '#FFE08A', fries: '#FFEE8F', donut: '#FF9AD5', icecream: '#A8E6FF', salad: '#A6F0B5', curry: '#FFB347',
  coffee: '#E8C9A0', wine: '#D8B4FF', pasta: '#FFD6A5', boba: '#FFB3E6', cupcake: '#FFC2E2', plate: '#CDB8FF',
  french: '#F4A6A0', bistro: '#FFB98A', cassoulet: '#E8B98A', mezze: '#C9E8A8', thai: '#FFE08A', african: '#FFB347',
  tagine: '#FFB27A', couscous: '#FFE08A', korean: '#FFC2B0', crepe: '#FFE2A8', seafood: '#A8E6FF', tapas: '#FFB3A8',
  sandwich: '#FFDD8A', vietnam: '#C9F0B0', chinese: '#FFC2C2',
  dumpling: '#FFE9B0', steak: '#FF9F8A', hotdog: '#FFC27A', croque: '#FFDD8A', brunch: '#FFE08A',
};

const SATELLITES = [
  { left: '9%', top: '14%', rotate: -14 },
  { right: '9%', top: '18%', rotate: 12 },
  { left: '14%', bottom: '10%', rotate: 10 },
  { right: '12%', bottom: '8%', rotate: -10 },
] as const;

interface CoverArtProps {
  name: string;
  cuisine: string;
  className?: string;
}

/** Couverture illustrée pour les restaurants sans photo : une vraie composition, pas un placeholder. */
export function CoverArt({ name, cuisine, className = '' }: CoverArtProps) {
  const main = stickerFor(cuisine, name, name);
  const satellites = satellitesFor(main);

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
        const { rotate, ...place } = pos;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={stickerSrc(satellites[i])}
            alt=''
            draggable={false}
            className={`absolute aspect-square object-contain opacity-90 pointer-events-none ${i % 2 ? 'h-[14%]' : 'h-[20%]'}`}
            style={{ ...place, transform: `rotate(${rotate}deg)` }}
          />
        );
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stickerSrc(main)} alt='' draggable={false} className='relative h-[72%] aspect-square object-contain bob' style={{ ['--r' as string]: '-6deg' }} />
    </div>
  );
}
