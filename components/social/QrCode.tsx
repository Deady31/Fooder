'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/** QR code généré dans le navigateur (aucun service tiers). */
export function QrCode({ value, size = 200, className = '' }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!value) return;
    QRCode.toDataURL(value, { errorCorrectionLevel: 'L', margin: 1, width: size * 2, color: { dark: '#2B0F3A', light: '#FFFFFF' } })
      .then(url => alive && setSrc(url))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (error) return <p className='text-xs font-bold text-plum/60 text-center'>QR code indisponible, partage le lien.</p>;
  if (!src) return <div className={`animate-pulse bg-white rounded-xl ${className}`} style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt='QR code de ta carte Fooder' width={size} height={size} className={`rounded-xl ${className}`} />;
}
