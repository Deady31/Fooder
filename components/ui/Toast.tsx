'use client';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/** Petit message temporaire en bas d'écran. */
export function useToast(duration = 2400) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), duration);
    return () => clearTimeout(t);
  }, [msg, duration]);
  const show = useCallback((m: string) => setMsg(m), []);
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className='fixed bottom-24 inset-x-0 z-[160] flex justify-center pointer-events-none px-6'
          role='status'
        >
          <span className='chip pointer-events-auto max-w-sm !items-center !gap-2 bg-lemon text-plum !px-4 !py-2 text-left'>
            {/* Texte toujours en entier : il passe à la ligne et réduit sa taille s'il est long, jamais de « … ». */}
            <span className={`min-w-0 break-words font-bold leading-snug ${msg.length > 90 ? 'text-[11px]' : 'text-xs'}`}>{msg}</span>
            <button
              type='button'
              onClick={() => setMsg(null)}
              aria-label='Fermer le message'
              className='shrink-0 -my-1 -mr-2 w-8 h-8 flex items-center justify-center rounded-full text-plum active:bg-white/60'
            >
              <X className='w-4 h-4' strokeWidth={3} aria-hidden='true' />
            </button>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { show, node };
}
