'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet } from '../ui/Sheet';
import { hasCompletedOnboarding, readTermsAcceptance, recordTermsAcceptance } from '../../lib/profile';
import { shouldShowTermsGate } from '../../lib/legal';

interface Snapshot {
  onboardingDone: boolean;
  acceptance: unknown;
}

function readSnapshot(): Snapshot {
  return { onboardingDone: hasCompletedOnboarding(), acceptance: readTermsAcceptance() };
}

/**
 * Fenêtre d'acceptation des conditions pour les utilisateurs déjà inscrits (ou dont la version acceptée est plus ancienne).
 * Non fermable sans accepter ; les pages légales restent lisibles (la fenêtre s'efface sur /legal/*).
 */
export function TermsGate() {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Relu à chaque changement de page : au retour d'une page légale, la fenêtre revient tant que rien n'est accepté.
  useEffect(() => setSnapshot(readSnapshot()), [pathname]);

  const open = snapshot !== null && shouldShowTermsGate({ pathname, ...snapshot });

  const accept = () => {
    recordTermsAcceptance();
    setSnapshot(readSnapshot());
  };

  return (
    <Sheet open={open} onClose={() => { /* non fermable sans accepter */ }} labelledBy='terms-gate-title' describedBy='terms-gate-text'
      dismissOnBackdrop={false} draggable={false} initialFocusRef={acceptRef} variant='bottom'
      className='bg-cream rounded-3xl border-[3px] border-plum p-5 space-y-4'>
      <h2 id='terms-gate-title' className='font-display text-2xl text-plum leading-tight'>Nos conditions ont une version à jour</h2>
      <p id='terms-gate-text' className='text-sm font-semibold text-plum leading-snug'>
        Pour continuer sur Fooder, accepte les Conditions d&apos;utilisation et la Politique de confidentialité. On y précise notamment
        ce que tu nous autorises à faire des photos que tu publies.
      </p>
      <p className='text-sm font-bold text-plum'>
        <Link href='/legal/terms' className='underline'>Lire les conditions</Link>
        {' · '}
        <Link href='/legal/privacy' className='underline'>Lire la confidentialité</Link>
      </p>
      <button ref={acceptRef} type='button' onClick={accept}
        className='duo-button w-full bg-fooder-primary border-fooder-primary text-white text-lg py-4'>
        J&apos;accepte
      </button>
    </Sheet>
  );
}
