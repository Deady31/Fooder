'use client';
import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { ConsentBanner } from './legal/ConsentBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <MotionConfig reducedMotion='user'>
      {children}
      <ConsentBanner />
    </MotionConfig>
  );
}
