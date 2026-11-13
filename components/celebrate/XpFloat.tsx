'use client';
import { useEffect, useRef } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import type { XpBubble } from '../../lib/celebrations';

interface XpFloatProps {
  bubble: XpBubble | null;
  onDone: () => void;
  /** Durée de vie après le dernier gain, en ms. */
  duration?: number;
}

export const XP_FLOAT_MS = 1100;

/** Compteur qui défile de `from` à `to` sans re-rendu React (écrit directement dans le nœud). */
function Counter({ from, to }: { from: number; to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(from);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || from === to) {
      node.textContent = String(to);
      value.set(to);
      return;
    }
    const controls = animate(value, to, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => { node.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [from, to, reduce, value]);

  return <span ref={ref}>{from}</span>;
}

/**
 * « +15 XP » qui s'envole depuis la zone d'action (au-dessus des boutons ♥/✕) puis s'efface.
 * Les gains rapprochés sont regroupés en amont (coalesceXp) : la bulle reste et son compteur monte.
 */
export function XpFloat({ bubble, onDone, duration = XP_FLOAT_MS }: XpFloatProps) {
  const reduce = useReducedMotion();
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Le minuteur repart à chaque nouveau gain (bubble.at), jamais à cause d'un re-rendu du parent.
  const at = bubble?.at;
  useEffect(() => {
    if (at === undefined) return;
    const t = setTimeout(() => onDoneRef.current(), duration);
    return () => clearTimeout(t);
  }, [at, duration]);

  return (
    <div className='pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+150px)] z-[200] flex justify-center' aria-hidden='true'>
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.6, rotate: -6 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: -40, scale: 1, rotate: -3 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -72, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          >
            <motion.span
              key={bubble.amount}
              className='chip bg-fooder-secondary text-plum font-display !text-xl !px-4 !py-1.5 shadow-hard'
              initial={reduce ? false : { scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              +<Counter from={bubble.from} to={bubble.amount} /> XP
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
