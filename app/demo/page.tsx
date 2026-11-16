'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startDemo } from '../../lib/demo';
import { Logo } from '../../components/ui/Logo';

/** Entrée de la démo : crée un profil invité local (sans compte ni cloud) puis ouvre le deck. */
export default function Demo() {
  const router = useRouter();

  useEffect(() => {
    router.replace(startDemo() ? '/swipe' : '/onboarding');
  }, [router]);

  return (
    <main aria-busy='true' className='h-full flex items-center justify-center bg-cream'>
      <Logo className='w-[min(60vw,240px)]' />
      <span className='sr-only' role='status'>Chargement de la démo…</span>
    </main>
  );
}
