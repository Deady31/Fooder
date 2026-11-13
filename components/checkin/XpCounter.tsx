'use client';
import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface XpCounterProps {
  value: number;
  className?: string;
  /** Durée du défilement en secondes. */
  duration?: number;
  /** Délai avant le défilement (laisse le temps à la feuille de se poser). */
  delay?: number;
}

/**
 * « +40 XP » qui défile de 0 à `value` (écrit directement dans le nœud, sans re-rendu).
 * Mouvement réduit : la valeur finale s'affiche tout de suite. Le texte final est exposé aux lecteurs d'écran.
 */
export function XpCounter({ value, className, duration = 0.7, delay = 0.15 }: XpCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const text = (n: number) => `+${Math.round(n)} XP`;
    if (reduce) {
      node.textContent = text(value);
      return;
    }
    node.textContent = text(0);
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => {
        node.textContent = text(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce, duration, delay]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden='true'>{`+${value} XP`}</span>
      <span className='sr-only'>{`Plus ${value} XP`}</span>
    </span>
  );
}
