'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './ui/Logo';

const KEY = 'fooder_splash_seen';
const DURATION_MS = 1700;

/** Écran de lancement : logo au centre pendant 2 s, une fois par ouverture de l'appli (pas à chaque page). */
export function Splash() {
  const pathname = usePathname();
  const skip = pathname === '/admin' || pathname?.startsWith('/admin/') || pathname?.startsWith('/legal');
  const [visible, setVisible] = useState(!skip);

  useEffect(() => {
    if (skip) return setVisible(false);
    try {
      if (sessionStorage.getItem(KEY)) return setVisible(false);
    } catch {
      // stockage indisponible : on affiche quand même
    }
    const t = setTimeout(() => {
      try { sessionStorage.setItem(KEY, '1'); } catch { /* sans effet */ }
      setVisible(false);
    }, DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key='splash'
          role='status'
          aria-label='Chargement de Fooder'
          className='fixed inset-0 z-[500] flex items-center justify-center bg-cream'
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div initial={{ scale: 0.8, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
            <Logo className='w-[min(62vw,280px)]' />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
