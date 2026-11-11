'use client';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
          <span className='chip bg-lemon text-plum text-xs !px-4 !py-2 text-center'>{msg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { show, node };
}
