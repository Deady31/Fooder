'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useMissions } from '../../hooks/useMissions';
import type { Mission } from '../../lib/missions';

interface MissionsChipProps {
  className?: string;
}

function Bar({ value, className = '' }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={`block h-2 overflow-hidden rounded-full border-2 border-plum bg-white ${className}`} aria-hidden='true'>
      <motion.span
        className='block h-full origin-left bg-mint'
        initial={false}
        animate={{ scaleX: v }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
      />
    </span>
  );
}

function MissionRow({ m }: { m: Mission }) {
  return (
    <li className='flex items-center gap-3 py-2'>
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-plum ${m.completed ? 'bg-mint' : 'bg-cream'}`}
        aria-hidden='true'
      >
        {m.completed ? <Check size={18} strokeWidth={3} className='text-plum' /> : <span className='text-[11px] font-black text-plum'>{m.current}/{m.target}</span>}
      </span>
      <div className='min-w-0 flex-1'>
        <p className={`truncate text-sm font-bold text-plum ${m.completed ? 'line-through decoration-2' : ''}`}>{m.title}</p>
        <p className='truncate text-xs font-semibold text-plum opacity-80'>{m.description}</p>
        {!m.completed && <Bar value={m.current / m.target} className='mt-1' />}
      </div>
      <span className={`chip flex-shrink-0 text-plum ${m.completed ? 'bg-mint' : 'bg-fooder-secondary'}`}>+{m.xpReward} XP</span>
      <span className='sr-only'>{m.completed ? 'terminée' : `${m.current} sur ${m.target}`}</span>
    </li>
  );
}

/** Puce « 2/3 missions » avec barre ; touchée, elle déroule la liste des missions du jour. */
export function MissionsChip({ className = '' }: MissionsChipProps) {
  const { missions, completedCount, total } = useMissions();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (total === 0) return null;
  const allDone = completedCount === total;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type='button'
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className={`chip min-h-11 !gap-2 !pl-3 !pr-3 text-plum ${allDone ? 'bg-mint' : 'bg-white'}`}
      >
        <span className='font-display text-sm leading-none'>{completedCount}/{total}</span>
        <span className='leading-none'>{allDone ? 'missions faites !' : 'missions'}</span>
        <Bar value={completedCount / total} className='w-10' />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role='region'
            aria-label='Missions du jour'
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className='absolute right-0 top-full z-[90] mt-2 w-[min(320px,calc(100vw-32px))] origin-top-right rounded-[22px] bg-white px-4 py-3 panel'
          >
            <div className='flex items-baseline justify-between'>
              <p className='font-display text-lg text-plum'>Missions du jour</p>
              <p className='text-xs font-bold text-plum opacity-80'>Nouvelles demain</p>
            </div>
            <ul className='mt-1 divide-y-2 divide-plum/10'>
              {missions.map(m => <MissionRow key={m.id} m={m} />)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
