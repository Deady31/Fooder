'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { ConsentBanner } from './legal/ConsentBanner';
import { Tracker } from './analytics/Tracker';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = pathname === '/admin' || pathname?.startsWith('/admin/');

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <MotionConfig reducedMotion='user'>
      {children}
      {admin ? null : <ConsentBanner />}
      <Tracker />
    </MotionConfig>
  );
}
