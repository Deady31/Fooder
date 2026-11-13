'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { pageEntry } from '../../lib/shell';

/** Entrée de page : fondu court pour les onglets, glissement latéral pour les écrans enfants. Pas de sortie (limite des templates). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { initial, animate, transition } = pageEntry(pathname, reduced);
  return (
    <motion.div className='h-full' initial={initial} animate={animate} transition={transition as never}>
      {children}
    </motion.div>
  );
}
