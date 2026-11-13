'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { captureRef } from '../lib/invite';
import { hasCompletedOnboarding } from '../lib/profile';
import { decideEntry } from '../lib/shell';
import { Logo } from '../components/ui/Logo';

/**
 * Point d'entrée : mémorise le ?ref= d'un lien d'invitation, puis envoie directement
 * l'inscrit sur /swipe et les autres sur l'onboarding (une seule redirection, jamais de page vide).
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const { destination } = decideEntry({ registered: hasCompletedOnboarding(), search: window.location.search });
    captureRef(window.location.search);
    router.replace(destination);
  }, [router]);

  return (
    <main aria-busy='true' className='h-full flex items-center justify-center bg-cream'>
      <Logo className='w-[min(60vw,240px)]' />
      <span className='sr-only' role='status'>Chargement…</span>
    </main>
  );
}
