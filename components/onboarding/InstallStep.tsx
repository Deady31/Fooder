'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, PlusSquare, Share } from 'lucide-react';
import { StepFrame } from './StepFrame';
import { installCapture } from '../pwa/installCapture';
import { cleanInstallUrl } from '../pwa/installLogic';
import type { OnboardingInstallMode } from '../pwa/installLogic';

interface InstallStepProps {
  mode: Exclude<OnboardingInstallMode, 'skip'>;
  /** Passe à l'étape suivante (après installation, copie ou « Plus tard ») */
  onNext: () => void;
}

const BOX = 'w-12 h-12 shrink-0 rounded-xl border-[3px] border-plum flex items-center justify-center';

/** Mode d'emploi iOS : trois petites vignettes aux couleurs de la marque, sans image externe. */
function IosSteps() {
  const rows = [
    {
      n: 1,
      text: <>Touche <strong>Partager</strong> en bas de Safari.</>,
      visual: (
        <span className={`${BOX} bg-fooder-secondary`}>
          <Share className='w-6 h-6 text-plum' strokeWidth={2.5} />
        </span>
      ),
    },
    {
      n: 2,
      text: <>Choisis <strong>Sur l’écran d’accueil</strong> dans la liste.</>,
      visual: (
        <span className={`${BOX} bg-bubblegum`}>
          <PlusSquare className='w-6 h-6 text-plum' strokeWidth={2.5} />
        </span>
      ),
    },
    {
      n: 3,
      text: <>Touche <strong>Ajouter</strong> en haut à droite.</>,
      visual: (
        <span className='h-12 shrink-0 rounded-xl border-[3px] border-plum bg-lemon px-3 flex items-center text-sm font-black text-plum'>
          Ajouter
        </span>
      ),
    },
  ];
  return (
    <ol className='space-y-3'>
      {rows.map((r, i) => (
        <motion.li
          key={r.n}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 + i * 0.08 }}
          className='flex items-center gap-3 rounded-2xl border-[3px] border-plum bg-white shadow-hard px-3 py-2.5'
        >
          <span className='w-7 h-7 shrink-0 rounded-full bg-plum text-white text-sm font-black flex items-center justify-center' aria-hidden='true'>{r.n}</span>
          <span className='min-w-0 flex-1 text-left text-sm font-bold text-plum leading-snug'>{r.text}</span>
          {r.visual}
        </motion.li>
      ))}
    </ol>
  );
}

function InAppCopy() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const url = typeof window === 'undefined' ? '' : cleanInstallUrl(window.location.href);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className='space-y-3'>
      <p className='rounded-2xl border-[3px] border-plum bg-white shadow-hard px-4 py-3 text-sm font-bold text-plum leading-snug text-left'>
        Ouvre ce lien dans Chrome ou Safari pour pouvoir installer.
      </p>
      <input readOnly value={url} aria-label='Adresse de Fooder' onFocus={e => e.currentTarget.select()}
        className='w-full rounded-xl border-[3px] border-plum bg-cream px-3 py-2.5 text-sm font-semibold text-plum' />
      <button type='button' onClick={copy}
        className='duo-button w-full bg-bubblegum text-plum text-base py-3 flex items-center justify-center gap-2'>
        {status === 'copied' ? <Check className='w-5 h-5' strokeWidth={3} /> : <Copy className='w-5 h-5' strokeWidth={3} />}
        {status === 'copied' ? 'Lien copié !' : 'Copier le lien'}
      </button>
      <p role='status' className='min-h-[1.25rem] text-xs font-semibold text-slate-500 text-center'>
        {status === 'copied' && 'Colle-le dans la barre d’adresse de ton navigateur.'}
        {status === 'failed' && 'Copie impossible : touche l’adresse ci-dessus, sélectionne-la et copie-la.'}
      </p>
    </div>
  );
}

/** Étape « Mets Fooder sur ton écran d'accueil » : affichée seulement si l'appli n'est pas déjà installée. */
export function InstallStep({ mode, onNext }: InstallStepProps) {
  const [busy, setBusy] = useState(false);

  const installNative = async () => {
    const capture = installCapture();
    const event = capture.get();
    if (!event || busy) {
      onNext();
      return;
    }
    setBusy(true);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* invite fermée ou indisponible : on continue l'inscription */
    }
    capture.clear(); // l'invite native ne peut servir qu'une fois
    onNext();
  };

  const later = (
    <button type='button' onClick={onNext}
      className='w-full min-h-[44px] mt-1 text-center text-sm font-black text-plum/70 underline underline-offset-2'>
      Plus tard
    </button>
  );

  const subtitle = 'Plein écran, lancement en un tap, comme une vraie app.';

  if (mode === 'native') {
    return (
      <StepFrame kicker='Presque fini' title={<>Mets Fooder sur ton<br />écran d’accueil</>} subtitle={subtitle} sticker='pizza'
        cta={busy ? 'Un instant…' : 'Installer'} onCta={installNative} ctaDisabled={busy} secondary={later} centered>
        <p className='text-center text-sm font-semibold text-slate-600'>Un tap, et Fooder rejoint tes applis.</p>
      </StepFrame>
    );
  }

  if (mode === 'ios') {
    return (
      <StepFrame kicker='Presque fini' title={<>Mets Fooder sur ton<br />écran d’accueil</>} subtitle='Trois gestes dans Safari.' sticker='pizza'
        cta='Compris' onCta={onNext} secondary={later} centered>
        <IosSteps />
      </StepFrame>
    );
  }

  return (
    <StepFrame kicker='Presque fini' title={<>Mets Fooder sur ton<br />écran d’accueil</>} subtitle={subtitle} sticker='pizza'
      cta='Continuer' onCta={onNext} secondary={later} centered>
      <InAppCopy />
    </StepFrame>
  );
}
