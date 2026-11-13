'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Map, Heart, User, Users } from 'lucide-react';
import { likesCount, subscribeLikes } from '../../lib/likes';
import { badgeLabel, isTabActive, tabIndexAfter } from '../../lib/shell';

const TABS = [
  { href: '/swipe', label: 'Découvrir', Icon: Layers },
  { href: '/map', label: 'Carte', Icon: Map },
  { href: '/feed', label: 'Fil', Icon: Users },
  { href: '/wishlist', label: 'Favoris', Icon: Heart },
  { href: '/profile', label: 'Profil', Icon: User },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const [likes, setLikes] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  // Badge de favoris : relu à chaque changement du store (autre onglet du navigateur inclus) et de page.
  useEffect(() => {
    const sync = () => setLikes(likesCount());
    sync();
    return subscribeLikes(sync);
  }, [pathname]);

  // Flèches / Début / Fin : déplacent le focus d'un onglet à l'autre (Tab reste utilisable).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const links = Array.from(navRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const next = tabIndexAfter(e.key, links.indexOf(document.activeElement as HTMLAnchorElement), links.length);
    if (next === null) return;
    e.preventDefault();
    links[next]?.focus();
  };

  const badge = badgeLabel(likes);

  return (
    <nav
      ref={navRef}
      aria-label='Navigation principale'
      onKeyDown={onKeyDown}
      className='shrink-0 z-30 flex gap-1.5 px-2.5 pt-2.5 pb-[max(env(safe-area-inset-bottom),10px)] bg-cream border-t-[3px] border-plum'
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isTabActive(pathname, href);
        const showBadge = href === '/wishlist' && badge !== null;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={showBadge ? `${label}, ${likes} resto${likes > 1 ? 's' : ''}` : undefined}
            className='relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl'
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
                <Icon aria-hidden='true' className={`w-6 h-6 ${active ? 'text-plum' : 'text-plum-soft'}`} strokeWidth={2.5} />
                <AnimatePresence>
                  {showBadge && (
                    <motion.span
                      key={badge}
                      aria-hidden='true'
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                      className='absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-bubblegum border-2 border-plum text-[10px] font-black text-plum flex items-center justify-center'
                    >
                      {badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={`text-[11px] font-bold ${active ? 'text-plum' : 'text-plum-soft'}`}>{label}</span>
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}
