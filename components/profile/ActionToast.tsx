'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ActionToastState {
  /** Change à chaque nouveau message : relance le minuteur même si le texte est identique. */
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ActionToastProps {
  toast: ActionToastState | null;
  onDismiss: () => void;
  duration?: number;
}

/** Message temporaire avec une action facultative (« Annuler »). Minuteur annulé au démontage. */
export function ActionToast({ toast, onDismiss, duration = 5000 }: ActionToastProps) {
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
    // onDismiss est supposé stable ; seul un nouveau message relance le délai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, duration]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className='fixed bottom-24 inset-x-0 z-[160] flex justify-center px-4 pointer-events-none'
        >
          <div role='status' className='pointer-events-auto flex items-center gap-3 bg-plum text-cream rounded-full border-[3px] border-plum pl-4 pr-1.5 py-1 shadow-hard max-w-full'>
            <span className='text-sm font-bold truncate'>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction?.();
                  onDismiss();
                }}
                className='shrink-0 min-h-[44px] px-4 rounded-full bg-lemon text-plum text-sm font-black active:translate-y-0.5 transition-transform'
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
