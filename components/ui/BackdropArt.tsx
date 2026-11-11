import { Sticker } from './Sticker';
import { StickerName } from '../../lib/stickers';

interface Blob {
  className: string;
  color: string;
}

interface Floater {
  name: StickerName;
  size: number;
  rotate: number;
  style: React.CSSProperties;
  delay: number;
}

// Formes organiques à plat (pas de flou, pas de dégradé) pour rester dans l'esprit sticker.
const BLOBS: Blob[] = [
  { className: 'left-[-18%] top-[10%] h-[46%] w-[70%] rounded-[58%_42%_55%_45%/50%_55%_45%_50%]', color: 'var(--bubblegum)' },
  { className: 'right-[-24%] top-[44%] h-[40%] w-[66%] rounded-[45%_55%_40%_60%/55%_45%_60%_40%]', color: 'var(--lemon)' },
  { className: 'left-[-14%] bottom-[-6%] h-[26%] w-[56%] rounded-[55%_45%_60%_40%/45%_60%_40%_55%]', color: 'var(--mint)' },
  { className: 'right-[-10%] top-[-4%] h-[22%] w-[44%] rounded-[50%_50%_45%_55%/60%_40%_60%_40%]', color: 'var(--violet)' },
];

const FLOATERS: Floater[] = [
  { name: 'burger', size: 64, rotate: -14, style: { left: '-3%', top: '12%' }, delay: 0 },
  { name: 'boba', size: 58, rotate: 12, style: { right: '-3%', top: '24%' }, delay: 0.6 },
  { name: 'donut', size: 60, rotate: 18, style: { left: '-2%', top: '50%' }, delay: 1.1 },
  { name: 'taco', size: 62, rotate: -10, style: { right: '-3%', top: '58%' }, delay: 0.3 },
  { name: 'croissant', size: 56, rotate: 10, style: { left: '3%', bottom: '5%' }, delay: 0.9 },
  { name: 'icecream', size: 58, rotate: -12, style: { right: '4%', bottom: '4%' }, delay: 1.4 },
  { name: 'sparkle', size: 30, rotate: 0, style: { left: '16%', top: '4%' }, delay: 0.2 },
  { name: 'sparkle', size: 24, rotate: 0, style: { right: '18%', top: '40%' }, delay: 0.8 },
];

/** Décor de fond de l'écran Découvrir : formes à plat, ruban damier et stickers qui flottent derrière la carte. */
export function BackdropArt({ premium = false }: { premium?: boolean }) {
  return (
    <div aria-hidden className='absolute inset-0 overflow-hidden pointer-events-none z-0'>
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className={`absolute border-[3px] border-plum/15 ${b.className}`}
          style={{ backgroundColor: b.color, opacity: premium ? 0.32 : 0.26 }}
        />
      ))}

      <div
        className='absolute -right-8 top-[16%] h-6 w-40 rotate-[28deg] border-y-[3px] border-plum/20 opacity-60'
        style={{
          backgroundImage: 'repeating-conic-gradient(var(--plum) 0 25%, #fff 0 50%)',
          backgroundSize: '24px 24px',
        }}
      />

      {FLOATERS.map((f, i) => (
        <div
          key={i}
          className='absolute bob opacity-90'
          style={{ ...f.style, ['--r' as string]: `${f.rotate}deg`, animationDelay: `${f.delay}s` }}
        >
          <Sticker name={f.name} size={f.size} />
        </div>
      ))}
    </div>
  );
}
