'use client';
import { motion, useReducedMotion } from 'framer-motion';

interface ScaleBarProps {
  /** 0 → 1 */
  value: number;
  /** Valeur de départ de l'animation (défaut 0). */
  from?: number;
  /** Classes de couleur de la barre (ex. « bg-bubblegum »). */
  barClassName: string;
  /** Classes de la piste (fond, bordure, hauteur). */
  trackClassName: string;
  delay?: number;
  duration?: number;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Jauge animée en `scaleX` (compositeur) : jamais de `width`, donc pas de recalcul de mise en page. */
export function ScaleBar({ value, from = 0, barClassName, trackClassName, delay = 0.15, duration = 0.9 }: ScaleBarProps) {
  const reduced = useReducedMotion();
  const target = clamp01(value);
  return (
    <div className={`overflow-hidden ${trackClassName}`}>
      <motion.div
        className={`h-full w-full origin-left ${barClassName}`}
        initial={{ scaleX: reduced ? target : clamp01(from) }}
        animate={{ scaleX: target }}
        transition={reduced ? { duration: 0 } : { duration, delay, ease: 'easeOut' }}
      />
    </div>
  );
}
