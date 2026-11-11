'use client';
import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'hidden' | 'android' | 'ios';

/** Aide à installer Fooder sur l'écran d'accueil : bouton natif (Android) ou mode d'emploi (iPhone). */
export function InstallCard() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setMode('ios');

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
    };
    const onInstalled = () => setMode('hidden');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode === 'hidden') return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode('hidden');
  };

  return (
    <section className='mb-4 bg-white panel rounded-3xl p-4' aria-label="Installer l'application">
      <p className='font-display text-lg leading-tight text-plum'>Fooder sur ton écran d&apos;accueil</p>
      {mode === 'android' ? (
        <>
          <p className='text-xs font-semibold text-slate-600 mt-1'>Plein écran, lancement en un tap, comme une vraie app.</p>
          <button onClick={install} className='duo-button w-full mt-3 bg-bubblegum text-plum text-sm flex items-center justify-center gap-2'>
            <Download className='w-4 h-4' strokeWidth={3} /> Installer l&apos;app
          </button>
        </>
      ) : (
        <ol className='mt-2 space-y-1.5 text-xs font-semibold text-slate-700 list-decimal pl-4'>
          <li>
            Ouvre cette page dans <strong>Safari</strong>.
          </li>
          <li className='flex items-center gap-1 flex-wrap'>
            Touche <Share className='w-3.5 h-3.5 inline' strokeWidth={3} /> <strong>Partager</strong> en bas de l&apos;écran.
          </li>
          <li>
            Choisis <strong>Sur l&apos;écran d&apos;accueil</strong>, puis <strong>Ajouter</strong>.
          </li>
        </ol>
      )}
    </section>
  );
}
