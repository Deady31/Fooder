'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '../../hooks/useNotifications';
import { AppNotification } from '../../lib/notifications';
import { timeAgo } from '../../lib/feed';
import { Sticker } from '../ui/Sticker';
import { StickerName, badgeFor } from '../../lib/stickers';

function stickerOf(n: AppNotification): StickerName {
  if (n.kind === 'achievement') return badgeFor(n.ref ?? '');
  if (n.kind === 'feed') return 'b_heart';
  if (n.kind === 'social') return 'b_dice';
  return 'sparkle';
}

export function NotificationBell() {
  const { items, unread, readAll, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    readAll();
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        className='relative w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all'
      >
        <motion.span
          key={unread}
          animate={unread > 0 ? { rotate: [0, -16, 14, -10, 6, 0] } : {}}
          transition={{ duration: 0.6 }}
          className='flex'
        >
          <Bell className='w-5 h-5 text-plum' strokeWidth={2.5} />
        </motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
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

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[150] flex items-start justify-center p-3 pt-[max(env(safe-area-inset-top),12px)] bg-plum/60 backdrop-blur-sm'
            onClick={e => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.div
              initial={{ y: -60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className='w-full max-w-md max-h-[calc(100dvh-2rem)] bg-cream rounded-[28px] panel flex flex-col overflow-hidden'
            >
              <div className='flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b-[3px] border-plum'>
                <h2 className='text-[clamp(21px,6.6vw,26px)] leading-none text-plum'>Notifications</h2>
                <button
                  onClick={close}
                  aria-label='Fermer'
                  className='w-11 h-11 shrink-0 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
                >
                  <X className='w-5 h-5' strokeWidth={3} />
                </button>
              </div>

              <ul className='scroll-y divide-y-2 divide-dashed divide-plum/15'>
                {items.length === 0 && (
                  <li className='px-5 py-8 text-center text-sm font-bold text-plum/60'>Rien de neuf pour l&apos;instant.</li>
                )}
                {items.map(n => (
                  <li
                    key={n.id}
                    className={`flex items-center gap-3 px-5 py-3 ${n.read ? '' : 'bg-white'} ${n.href ? 'cursor-pointer active:bg-cream' : ''}`}
                    onClick={() => {
                      if (!n.href) return;
                      close();
                      router.push(n.href);
                    }}
                  >
                    <Sticker name={stickerOf(n)} size={44} rotate={-6} className='shrink-0' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-bold text-plum leading-tight'>{n.title}</p>
                      <p className='text-xs font-medium text-slate-600 leading-snug'>{n.body}</p>
                      <p className='text-[10px] font-bold text-plum/40 mt-0.5'>{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className='w-2.5 h-2.5 rounded-full bg-bubblegum border-2 border-plum shrink-0' aria-label='Non lue' />}
                    {n.href && <ChevronRight className='w-4 h-4 text-plum/50 shrink-0' strokeWidth={3} />}
                  </li>
                ))}
              </ul>

              {items.length > 0 && (
                <button onClick={clear} className='px-5 py-3 text-xs font-bold text-plum/60 border-t-[3px] border-plum active:bg-white'>
                  Tout effacer
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        , document.body)}
    </>
  );
}
