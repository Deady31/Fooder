'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { ConsentBanner } from './legal/ConsentBanner';
import { Splash } from './Splash';
import { Tracker } from './analytics/Tracker';
import { installCapture } from './pwa/installCapture';

const loadMotionFeatures = () => import('./motionFeatures').then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = pathname === '/admin' || pathname?.startsWith('/admin/');

  // L'événement d'installation n'est émis qu'une fois par chargement : on l'écoute dès le départ, quelle que soit la page.
  useEffect(() => {
    installCapture().start();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion='user'>
        {children}
        {admin ? null : <ConsentBanner />}
        <Tracker />
        <Splash />
      </MotionConfig>
    </LazyMotion>
  );
}
