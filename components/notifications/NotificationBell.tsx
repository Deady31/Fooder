'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '../../hooks/useNotifications';
import { AppNotification, restoreNotifications } from '../../lib/notifications';
import { timeAgo } from '../../lib/feed';
import { Sheet } from '../ui/Sheet';
import { Sticker } from '../ui/Sticker';
import { StickerName, badgeFor } from '../../lib/stickers';

const UNDO_MS = 5000;
const TITLE_ID = 'notifications-title';

function stickerOf(n: AppNotification): StickerName {
  if (n.kind === 'achievement') return badgeFor(n.ref ?? '');
  if (n.kind === 'feed') return 'b_heart';
  if (n.kind === 'social') return 'b_dice';
  return 'sparkle';
}

function Row({ n, onOpen }: { n: AppNotification; onOpen: (href: string) => void }) {
  const content = (
    <>
      <Sticker name={stickerOf(n)} size={44} rotate={-6} className='shrink-0' />
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-bold text-plum leading-tight'>{n.title}</p>
        <p className='text-xs font-medium text-slate-muted leading-snug'>{n.body}</p>
        <p className='text-[11px] font-bold text-plum-muted mt-0.5'>{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && (
        <span className='w-2.5 h-2.5 rounded-full bg-bubblegum border-2 border-plum shrink-0'>
          <span className='sr-only'>Non lue</span>
        </span>
      )}
    </>
  );
  const base = `flex items-center gap-3 px-5 py-3 w-full text-left min-h-[56px] ${n.read ? '' : 'bg-white'}`;
  return (
    <li>
      {n.href ? (
        <button type='button' onClick={() => onOpen(n.href!)} className={`${base} active:bg-cream`}>
          {content}
          <ChevronRight aria-hidden='true' className='w-4 h-4 text-plum-muted shrink-0' strokeWidth={3} />
        </button>
      ) : (
        <div className={base}>{content}</div>
      )}
    </li>
  );
}

export function NotificationBell() {
  const { items, unread, readAll, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [undo, setUndo] = useState<AppNotification[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const close = useCallback(() => {
    setOpen(false);
    readAll();
  }, [readAll]);

  const clearAll = () => {
    const snapshot = items;
    clear();
    setOpen(false); // la feuille se ferme : le toast « Annuler » reste atteignable au clavier
    setUndo(snapshot);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const undoClear = () => {
    if (undo) restoreNotifications(undo);
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        aria-haspopup='dialog'
        className='relative w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
      >
        <motion.span
          key={unread}
          animate={unread > 0 ? { rotate: [0, -16, 14, -10, 6, 0] } : {}}
          transition={{ duration: 0.6 }}
          className='flex'
        >
          <Bell aria-hidden='true' className='w-5 h-5 text-plum' strokeWidth={2.5} />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              aria-hidden='true'
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className='absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-bubblegum border-[2.5px] border-plum text-[11px] font-black text-plum flex items-center justify-center leading-none'
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <Sheet open={open} onClose={close} variant='top' labelledBy={TITLE_ID}
        className='bg-cream rounded-[28px] panel flex flex-col'>
        <div className='flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b-[3px] border-plum'>
          <h2 id={TITLE_ID} className='text-[clamp(21px,6.6vw,26px)] leading-none text-plum'>Notifications</h2>
          <button
            type='button'
            onClick={close}
            aria-label='Fermer'
            className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
          >
            <X aria-hidden='true' className='w-5 h-5' strokeWidth={3} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className='px-5 py-10 flex flex-col items-center text-center gap-2'>
            <Sticker name='sparkle' size={64} rotate={-6} />
            <p className='text-base font-bold text-plum'>Rien de neuf pour l&apos;instant</p>
            <p className='text-sm font-medium text-slate-muted'>Tes trophées et les réactions de tes amis apparaîtront ici.</p>
          </div>
        ) : (
          <ul className='divide-y-2 divide-dashed divide-plum/20'>
            {items.map(n => (
              <Row key={n.id} n={n} onOpen={href => { close(); router.push(href); }} />
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <button type='button' onClick={clearAll}
            className='min-h-[48px] px-5 py-3 text-sm font-bold text-plum-muted border-t-[3px] border-plum active:bg-white'>
            Tout effacer
          </button>
        )}
      </Sheet>

      {mounted && createPortal(
        <AnimatePresence>
          {undo && (
            <motion.div
              key='undo'
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role='status'
              className='fixed bottom-24 inset-x-0 z-[160] flex justify-center px-6 pointer-events-none'
            >
              <div className='pointer-events-auto flex items-center gap-3 bg-lemon text-plum border-[3px] border-plum rounded-full pl-4 pr-1.5 py-1.5 shadow-hard'>
                <span className='text-xs font-bold'>Notifications effacées</span>
                <button type='button' onClick={undoClear}
                  className='min-h-[44px] px-4 rounded-full bg-white border-2 border-plum text-xs font-black text-plum'>
                  Annuler
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
