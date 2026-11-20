'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isDemo } from '../../lib/demoFlag';

/** Bandeau « Démo » en haut de l'appli : rappelle que rien n'est enregistré dans un compte et mène à la vraie inscription. */
export function DemoBadge() {
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemo()), []);
  if (!demo) return null;
  return (
    <Link href='/onboarding'
      className='shrink-0 block bg-plum px-3 py-1.5 text-center text-xs font-bold text-white'>
      Mode démo, rien n&apos;est enregistré · <span className='underline'>Créer mon profil</span>
    </Link>
  );
}
