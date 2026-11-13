'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { DISMISS_KEY, InstallMode, decideInstall, isIosSafari, isStandalone } from './installLogic';
import { BeforeInstallPromptEvent, installCapture } from './installCapture';

function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function envState() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    standalone: isStandalone({ displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches, navigatorStandalone: nav.standalone }),
    iosSafari: isIosSafari({ ua: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints }),
  };
}

/** Invitation à installer Fooder : bouton natif (Android/Chrome) ou mode d'emploi (Safari iOS). Refus mémorisé 7 jours. */
export function InstallPrompt({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<InstallMode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const refresh = (hasPrompt: boolean) => {
      const env = envState();
      setMode(decideInstall({ ...env, hasPrompt, dismissedAt: readDismissedAt(), now: Date.now() }));
    };
    // L'événement a pu être capturé plus tôt (inscription) : on le reprend, et on écoute la suite.
    const capture = installCapture();
    capture.start();
    const sync = () => {
      const prompt = capture.get();
      setDeferred(prompt);
      refresh(prompt !== null);
    };
    sync();
    return capture.subscribe(sync);
  }, []);

  if (mode === 'hidden') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* stockage indisponible */
    }
    setSheet(false);
    setMode('hidden');
  };

  const install = async () => {
    if (mode === 'ios') {
      setSheet(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    installCapture().clear(); // l'invite native ne peut servir qu'une fois
    if (outcome === 'accepted') {
      setMode('hidden');
    } else {
      dismiss();
    }
  };

  return (
    <>
      <section className={`relative bg-white panel rounded-3xl p-4 pr-14 ${className}`} aria-label="Installer l’application">
        <button onClick={dismiss} aria-label='Plus tard' className='absolute top-1 right-1 w-11 h-11 rounded-full flex items-center justify-center text-plum-muted'>
          <X className='w-4 h-4' strokeWidth={3} />
        </button>
        <p className='font-display text-lg leading-tight text-plum'>Fooder sur ton écran d’accueil</p>
        <p className='text-xs font-semibold text-plum-muted mt-1'>Plein écran, lancement en un tap, comme une vraie app.</p>
        <button onClick={install} className='duo-button w-full mt-3 bg-bubblegum text-plum text-sm flex items-center justify-center gap-2'>
          <Download className='w-4 h-4' strokeWidth={3} /> Installer Fooder
        </button>
      </section>

      <AnimatePresence>
        {sheet && (
          <motion.div
            className='fixed inset-0 z-[70] flex items-end bg-plum/50'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheet(false)}
          >
            <motion.div
              role='dialog'
              aria-label='Installer Fooder sur iPhone'
              className='w-full bg-cream rounded-t-[32px] border-t-[3px] border-x-[3px] border-plum p-5 pb-8 space-y-4'
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
            >
              <div className='flex items-start justify-between gap-3'>
                <p className='font-display text-2xl text-plum leading-tight'>Installer Fooder</p>
                <button onClick={() => setSheet(false)} aria-label='Fermer' className='w-11 h-11 shrink-0 rounded-full bg-white border-[3px] border-plum flex items-center justify-center'>
                  <X className='w-4 h-4' strokeWidth={3} />
                </button>
              </div>
              <ol className='space-y-3'>
                <li className='flex items-center gap-3 bg-white rounded-2xl border-[3px] border-plum p-3'>
                  <span className='w-11 h-11 shrink-0 rounded-xl bg-fooder-secondary border-[3px] border-plum flex items-center justify-center'>
                    <Share className='w-5 h-5 text-plum' strokeWidth={2.5} />
                  </span>
                  <span className='text-sm font-bold text-plum'>
                    1. Touche <strong>Partager</strong> dans la barre de Safari.
                  </span>
                </li>
                <li className='flex items-center gap-3 bg-white rounded-2xl border-[3px] border-plum p-3'>
                  <span className='w-11 h-11 shrink-0 rounded-xl bg-bubblegum border-[3px] border-plum flex items-center justify-center'>
                    <PlusSquare className='w-5 h-5 text-plum' strokeWidth={2.5} />
                  </span>
                  <span className='text-sm font-bold text-plum'>
                    2. Choisis <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.
                  </span>
                </li>
              </ol>
              <button onClick={dismiss} className='w-full min-h-[44px] text-center text-xs font-black text-plum-muted underline underline-offset-2'>
                Plus tard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
