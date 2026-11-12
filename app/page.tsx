'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { captureRef } from '../lib/invite';

/** Point d'entrée : mémorise le ?ref= d'un lien d'invitation puis continue vers l'onboarding comme avant. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    captureRef(window.location.search);
    router.replace('/onboarding');
  }, [router]);

  return null;
}
