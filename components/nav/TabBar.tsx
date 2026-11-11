'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Map, Heart, User } from 'lucide-react';

const TABS = [
  { href: '/swipe', label: 'Découvrir', Icon: Layers },
  { href: '/map', label: 'Carte', Icon: Map },
  { href: '/wishlist', label: 'Favoris', Icon: Heart },
  { href: '/profile', label: 'Profil', Icon: User },
] as const;

function readLikesCount(): number {
  try {
    return JSON.parse(localStorage.getItem('fooder_likes') || '[]').length;
  } catch {
    return 0;
  }
}

export function TabBar() {
  const pathname = usePathname();
  const [likes, setLikes] = useState(0);

  useEffect(() => {
    setLikes(readLikesCount());
  }, [pathname]);

  return (
    <nav
      aria-label='Navigation principale'
      className='shrink-0 z-30 flex gap-1.5 px-2.5 pt-2.5 pb-[max(env(safe-area-inset-bottom),10px)] bg-cream border-t-[3px] border-plum'
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className='relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl'
          >
            {active && (
              <motion.span
                layoutId='tab-pill'
                className='absolute inset-0 rounded-2xl bg-fooder-secondary border-[3px] border-plum shadow-hard'
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <motion.span
              className='relative z-10 flex flex-col items-center gap-0.5'
              whileTap={{ scale: 0.88 }}
              animate={{ y: active ? -1 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              <span className='relative'>
                <Icon className={`w-6 h-6 ${active ? 'text-plum' : 'text-plum/55'}`} strokeWidth={2.5} />
                <AnimatePresence>
                  {href === '/wishlist' && likes > 0 && (
                    <motion.span
                      key={likes}
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                      className='absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-bubblegum border-2 border-plum text-[10px] font-black text-plum flex items-center justify-center'
                    >
                      {likes}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={`text-[11px] font-bold ${active ? 'text-plum' : 'text-plum/55'}`}>{label}</span>
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}
