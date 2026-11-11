'use client';
import { useEffect, useState } from 'react';
import { Sticker } from './Sticker';
import { stickerFor } from '../../lib/stickers';

interface FoodImageProps {
  src?: string;
  alt: string;
  cuisine?: string;
  className?: string;
}

export function FoodImage({ src, alt, cuisine = '', className = '' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div className={`${className} bg-fooder-secondary flex items-center justify-center`} role='img' aria-label={alt}>
        <Sticker name={stickerFor(cuisine, alt, alt)} size={96} rotate={-6} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} className={className} />
  );
}
