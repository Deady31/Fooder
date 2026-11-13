'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { LEVEL_THRESHOLDS } from '../../hooks/useGamification';
import { ScaleBar } from './ScaleBar';

const SEEN_KEY = 'fooder_profile_seen_xp';

interface XpGaugeProps {
  xp: number;
  level: number;
  xpProgress: number;
}

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** Progression de `xp` dans le palier du niveau courant (0 → 1). */
function progressWithin(xp: number, level: number): number {
  const start = LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)];
  const end = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)];
  return end > start ? Math.min(1, Math.max(0, (xp - start) / (end - start))) : 1;
}

/** Jauge de niveau : part de la dernière valeur vue, compteur d'XP animé, gain depuis la dernière visite. */
export function XpGauge({ xp, level, xpProgress }: XpGaugeProps) {
  const reduced = useReducedMotion();
  const counterRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef<number | null>(null);
  const [seen, setSeen] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
    setReady(true);
  }, []);

  // Le compteur anime de la valeur précédemment affichée (ou vue à la visite d'avant) vers l'XP actuel.
  useEffect(() => {
    if (!ready) return;
    const node = counterRef.current;
    if (!node) return;
    const start = shownRef.current ?? (seen !== null && seen <= xp ? seen : xp);
    shownRef.current = xp;
    if (reduced || start === xp) {
      node.textContent = String(xp);
    } else {
      const controls = animate(start, xp, {
        duration: 0.9,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: v => { node.textContent = String(Math.round(v)); },
      });
      return () => controls.stop();
    }
  }, [xp, ready, reduced, seen]);

  // La dernière valeur vue n'est mémorisée qu'une fois l'animation lancée.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(SEEN_KEY, String(xp));
    } catch {
      /* voir ci-dessus */
    }
  }, [xp, ready]);

  const gain = seen !== null && xp > seen ? xp - seen : 0;
  const from = seen !== null && seen <= xp ? progressWithin(seen, level) : 0;

  return (
    <div className='space-y-1'>
      <div className='flex justify-between items-baseline text-xs font-bold text-plum-muted'>
        <span>Niveau {level} · <span ref={counterRef}>{xp}</span> XP</span>
        <span>{Math.round(xpProgress * 100)}%</span>
      </div>
      {ready && (
        <ScaleBar
          value={xpProgress}
          from={from}
          trackClassName='h-4 bg-white border-[3px] border-plum rounded-full'
          barClassName='bg-bubblegum'
          delay={0.2}
          duration={1}
        />
      )}
      {!ready && <div className='h-4 bg-white border-[3px] border-plum rounded-full' />}
      {gain > 0 && <p className='text-xs font-bold text-success'>+{gain} XP depuis ta dernière visite</p>}
    </div>
  );
}
