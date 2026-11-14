'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, Heart, X } from 'lucide-react';
import { StepFrame } from './StepFrame';
import { Sticker } from '../ui/Sticker';

type Dir = 'left' | 'right';

const COMMIT_OFFSET = 90;
const EXIT_X = 420;

/**
 * Tutoriel en une slide : l'utilisateur essaie lui-même le geste (une fois à gauche, une fois à droite).
 * « J'ai compris » ne s'active qu'après les deux essais. Boutons et flèches du clavier en alternative au doigt.
 */
export function TutorialStep({ onNext }: { onNext: () => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, COMMIT_OFFSET], [0, 1]);
  const nopeOpacity = useTransform(x, [-COMMIT_OFFSET, -20], [1, 0]);
  const [done, setDone] = useState<Record<Dir, boolean>>({ left: false, right: false });
  // Pas de remontage de la carte (une clé changeante dans une AnimatePresence bloque la sortie de l'écran) :
  // on la réarme avec des valeurs animées.
  const pop = useMotionValue(1);
  const fade = useMotionValue(1);
  const busy = useRef(false);

  const commit = async (dir: Dir) => {
    if (busy.current) return;
    busy.current = true;
    await animate(x, dir === 'right' ? EXIT_X : -EXIT_X, { duration: 0.26, ease: 'easeOut' });
    setDone(d => ({ ...d, [dir]: true }));
    x.set(0);
    pop.set(0.92);
    fade.set(0);
    void animate(pop, 1, { type: 'spring', stiffness: 300, damping: 24 });
    void animate(fade, 1, { duration: 0.2 });
    busy.current = false;
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > COMMIT_OFFSET) void commit('right');
    else if (info.offset.x < -COMMIT_OFFSET) void commit('left');
    else animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') void commit('left');
      if (e.key === 'ArrowRight') void commit('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // commit ne dépend que de refs et de setters stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const both = done.left && done.right;
  const hint = both ? 'Parfait, tu as le geste !' : !done.left && !done.right ? 'Glisse la carte, ou touche un bouton' : done.left ? 'Maintenant à droite !' : 'Maintenant à gauche !';

  return (
    <StepFrame kicker='À toi de jouer' title={<>Essaie le swipe</>} cta="J'ai compris" onCta={onNext} ctaDisabled={!both} centered>
      <div className='flex flex-col items-center gap-3'>
        <div className='relative w-full max-w-[260px] h-[clamp(120px,26dvh,210px)]' aria-hidden={false}>
          <motion.div
            drag='x'
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            style={{ x, rotate, scale: pop, opacity: fade }}
            className='absolute inset-0 touch-pan-y cursor-grab active:cursor-grabbing rounded-[24px] border-[3px] border-plum bg-white shadow-hard-lg flex flex-col items-center justify-center gap-1 select-none'
          >
            <Sticker name='pizza' size={72} rotate={-6} />
            <p className='font-display text-lg text-plum leading-tight'>Carte d&apos;essai</p>
            <motion.span style={{ opacity: likeOpacity }} className='absolute top-3 left-3 -rotate-12 rounded-lg border-[3px] border-success px-2 py-0.5 text-sm font-black text-success'>MIAM</motion.span>
            <motion.span style={{ opacity: nopeOpacity }} className='absolute top-3 right-3 rotate-12 rounded-lg border-[3px] border-danger px-2 py-0.5 text-sm font-black text-danger'>BOF</motion.span>
          </motion.div>
        </div>

        <p role='status' className='text-sm font-black text-plum text-center'>{hint}</p>

        <div className='flex items-center gap-4'>
          <button type='button' onClick={() => void commit('left')} aria-label='Passer la carte (gauche)'
            className='relative w-14 h-14 rounded-full bg-white border-[3px] border-plum shadow-hard flex items-center justify-center active:translate-y-0.5 active:shadow-none transition-all'>
            <X className='w-7 h-7 text-danger' strokeWidth={4} aria-hidden='true' />
            {done.left && <Check className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-fooder-mint border-2 border-plum p-0.5 text-plum' strokeWidth={4} aria-label='Fait' />}
          </button>
          <button type='button' onClick={() => void commit('right')} aria-label='Aimer la carte (droite)'
            className='relative w-14 h-14 rounded-full bg-bubblegum border-[3px] border-plum shadow-hard flex items-center justify-center active:translate-y-0.5 active:shadow-none transition-all'>
            <Heart className='w-7 h-7 text-plum fill-white' strokeWidth={3} aria-hidden='true' />
            {done.right && <Check className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-fooder-mint border-2 border-plum p-0.5 text-plum' strokeWidth={4} aria-label='Fait' />}
          </button>
        </div>
      </div>
    </StepFrame>
  );
}
