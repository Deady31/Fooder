'use client';
import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import type { LevelEvent } from '../../lib/celebrations';
import { AVATARS, DEFAULT_AVATAR } from '../../lib/avatars';
import { PERKS } from '../../lib/rituals';
import { FOOD_STICKERS } from '../../lib/stickers';
import { feedback } from '../../lib/feedback';
import { Sticker } from '../ui/Sticker';
import { Avatar } from '../profile/Avatar';

interface LevelUpProps {
  event: LevelEvent;
  onDone: () => void;
}

/** Fermeture automatique de secours (l'utilisateur ferme normalement avec « Continuer »). */
export const LEVEL_UP_MAX_MS = 12_000;
const CONFETTI = 12;
const BG_CYCLE = ['bubblegum', 'lemon', 'mint', 'sky'] as const;

/** Ce que le passage de niveau débloque : mascottes et avantage, ou le prochain avantage à viser. */
export function levelUnlocks(from: number, to: number) {
  const mascots = AVATARS.filter(a => a.level > from && a.level <= to);
  const perk = [...PERKS].reverse().find(p => p.level > from && p.level <= to) ?? null;
  const nextPerk = PERKS.find(p => p.level > to) ?? null;
  return { mascots, perk, nextPerk };
}

function LevelNumber({ from, to }: { from: number; to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(from);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || from === to) {
      node.textContent = String(to);
      return;
    }
    const controls = animate(value, to, {
      duration: 0.8,
      delay: 0.25,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => { node.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [from, to, reduce, value]);
  return <span ref={ref}>{reduce ? to : from}</span>;
}

/** Célébration plein écran d'un passage de niveau. */
export function LevelUp({ event, onDone }: LevelUpProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const { mascots, perk, nextPerk } = useMemo(() => levelUnlocks(event.from, event.level), [event.from, event.level]);

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => {
        const angle = (i / CONFETTI) * Math.PI * 2 + 0.3;
        const dist = 130 + ((i * 47) % 110);
        return {
          name: FOOD_STICKERS[(i * 7 + event.level) % FOOD_STICKERS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          r: ((i * 71) % 140) - 70,
          size: 40 + ((i * 13) % 24),
          delay: 0.1 + (i % 4) * 0.05,
        };
      }),
    [event.level]
  );

  // Haptique, focus sur « Continuer », retour du focus à la fermeture, fermeture de secours.
  useEffect(() => {
    const previous = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    feedback('level');
    buttonRef.current?.focus();
    const t = setTimeout(() => onDoneRef.current(), LEVEL_UP_MAX_MS);
    return () => {
      clearTimeout(t);
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDoneRef.current();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      buttonRef.current?.focus();
    }
  };

  const plural = event.gained > 1;

  return (
    <motion.div
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className='fixed inset-0 z-[320] flex flex-col items-center justify-center overflow-hidden bg-fooder-primary px-6'
      onClick={() => onDoneRef.current()}
    >
      {/* Rayons tournants très lents : de la profondeur sans bruit visuel. */}
      {!reduce && (
        <motion.div
          aria-hidden='true'
          className='pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]'
          style={{ background: 'repeating-conic-gradient(from 0deg, #FFD83D 0deg 10deg, transparent 10deg 30deg)' }}
          initial={{ rotate: 0, scale: 0.6 }}
          animate={{ rotate: 40, scale: 1 }}
          transition={{ duration: 8, ease: 'linear' }}
        />
      )}

      {!reduce && confetti.map((c, i) => (
        <motion.div
          key={i}
          aria-hidden='true'
          className='pointer-events-none absolute left-1/2 top-[42%]'
          style={{ marginLeft: -c.size / 2, marginTop: -c.size / 2 }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: c.x, y: [0, c.y, c.y + 260], scale: [0, 1.15, 1], opacity: [1, 1, 0], rotate: c.r }}
          transition={{ duration: 2.2, delay: c.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.35, 1] }}
        >
          <Sticker name={c.name} size={c.size} />
        </motion.div>
      ))}

      <motion.div
        className='relative z-10 flex w-full max-w-sm flex-col items-center text-center'
        initial={reduce ? { opacity: 0 } : { scale: 0.4, rotate: -10, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <p className='font-display text-xl tracking-wider text-fooder-secondary'>
          {plural ? `+${event.gained} NIVEAUX !` : 'NIVEAU SUPÉRIEUR !'}
        </p>

        <div className='relative mt-4'>
          <motion.div
            className='flex h-40 w-40 flex-col items-center justify-center rounded-full bg-fooder-secondary panel'
            initial={reduce ? false : { rotate: -8 }}
            animate={reduce ? undefined : { rotate: [-8, 4, -2] }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <span className='text-xs font-black uppercase tracking-widest text-plum'>Niveau</span>
            <h2 id={titleId} className='font-display text-7xl leading-none text-plum'>
              <span className='sr-only'>Niveau </span>
              <LevelNumber from={event.from} to={event.level} />
            </h2>
          </motion.div>
          <span className='absolute -right-3 -top-2' aria-hidden='true'>
            <Sticker name='sparkle' size={44} rotate={14} />
          </span>
        </div>

        <div id={descId} className='mt-6 w-full space-y-3'>
          {mascots.length > 0 && (
            <div className='rounded-[22px] bg-cream px-4 py-3 panel'>
              <p className='text-[11px] font-black uppercase tracking-widest text-plum'>
                {mascots.length > 1 ? 'Nouvelles mascottes' : 'Nouvelle mascotte'}
              </p>
              <div className='mt-2 flex items-center justify-center gap-3'>
                {mascots.slice(0, 3).map((m, i) => (
                  <motion.div
                    key={m.id}
                    className='flex flex-col items-center gap-1'
                    initial={reduce ? false : { y: 24, scale: 0.5, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.45 + i * 0.1 }}
                  >
                    <Avatar avatar={{ id: m.id, bg: BG_CYCLE[i % BG_CYCLE.length] }} size={56} />
                    <span className='text-xs font-bold text-plum'>{m.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {mascots.length === 0 && (
            <div className='flex justify-center' aria-hidden='true'>
              <Avatar avatar={DEFAULT_AVATAR} size={64} />
            </div>
          )}

          {perk ? (
            <p className='chip mx-auto bg-mint text-plum !text-xs !px-4 !py-2'>
              <Sticker name={perk.sticker} size={22} /> Avantage débloqué : {perk.label}
            </p>
          ) : nextPerk ? (
            <p className='text-sm font-semibold text-white'>
              Prochain avantage au niveau {nextPerk.level} : {nextPerk.label}
            </p>
          ) : (
            <p className='text-sm font-semibold text-white'>Tu as atteint le sommet. Respect, Maître Foodie.</p>
          )}
        </div>

        <button
          ref={buttonRef}
          type='button'
          onClick={() => onDoneRef.current()}
          className='mt-8 min-h-12 rounded-full border-[3px] border-plum bg-white px-10 py-3 font-display text-lg text-plum shadow-hard transition-transform active:translate-y-1 active:shadow-hard-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-fooder-secondary'
        >
          Continuer
        </button>
      </motion.div>
    </motion.div>
  );
}
