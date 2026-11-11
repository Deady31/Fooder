import { StickerName, stickerSrc } from '../../lib/stickers';

interface StickerProps {
  name: StickerName;
  size?: number;
  rotate?: number;
  className?: string;
}

export function Sticker({ name, size = 64, rotate = 0, className = '' }: StickerProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stickerSrc(name)}
      alt=''
      width={size}
      height={size}
      draggable={false}
      className={`select-none pointer-events-none object-contain ${className}`}
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
    />
  );
}
