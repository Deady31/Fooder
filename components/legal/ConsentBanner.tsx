'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { analyticsEnabled, getConsent, setConsent } from '../../lib/analytics';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(analyticsEnabled() && getConsent() === null);
  }, []);

  const choose = (value: 'granted' | 'denied') => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          role='dialog'
          aria-label="Mesure d'audience"
          className='fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[180] mx-auto max-w-md bg-white panel rounded-3xl p-4'
        >
          <p className='text-sm font-bold text-plum leading-snug'>
            On mesure l&apos;usage de Fooder pour l&apos;améliorer, sans pub ni revente. Tu choisis.
          </p>
          <p className='text-xs text-slate-600 font-semibold mt-1'>
            <Link href='/legal/privacy' className='underline'>Politique de confidentialité</Link>
          </p>
          <div className='flex gap-2 mt-3'>
            <button onClick={() => choose('denied')} className='duo-button flex-1 bg-white text-plum text-sm'>Refuser</button>
            <button onClick={() => choose('granted')} className='duo-button flex-1 bg-bubblegum text-plum text-sm'>Accepter</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
