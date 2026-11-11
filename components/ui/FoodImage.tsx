'use client';
import { useEffect, useState } from 'react';
import { CoverArt } from './CoverArt';

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
    return <CoverArt name={alt} cuisine={cuisine} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} className={className} />
  );
}
