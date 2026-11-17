'use client';
import { forwardRef } from 'react';
import { m } from 'framer-motion';
import { Check } from 'lucide-react';
import type { HandArrow, Rect } from '../../lib/tourGeometry';

/** Teinte de l'assombri : la prune de la marque, pas un noir. */
const DIM = 'rgb(43 15 58 / 0.72)';
const HOLE_RADIUS = 18;

interface DimProps {
  /** Zone éclairée, en pixels de l'écran du tour ; null : tout assombri (bulle au centre, fin de tour). */
  hole: Rect | null;
  width: number;
  height: number;
}

/** Fond assombri avec un trou arrondi, et une bordure en pointillés autour de la zone éclairée. */
export function TourDim({ hole, width, height }: DimProps) {
  return (
    <svg className='absolute inset-0 w-full h-full pointer-events-none' width={width} height={height} aria-hidden='true'>
      <defs>
        <mask id='tour-hole'>
          <rect width='100%' height='100%' fill='white' />
          {hole && <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx={HOLE_RADIUS} fill='black' />}
        </mask>
      </defs>
      <rect width='100%' height='100%' fill={DIM} mask='url(#tour-hole)' />
      {hole && (
        <rect
          x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx={HOLE_RADIUS}
          fill='none' stroke='#FFF6E5' strokeWidth='3' strokeDasharray='2 7' strokeLinecap='round'
        />
      )}
    </svg>
  );
}

/** Quatre zones qui bloquent les touches autour de la zone éclairée (celle-ci reste utilisable). */
export function TourBlockers({ hole, width, height }: DimProps) {
  if (!hole) return <div className='absolute inset-0 pointer-events-auto' />;
  const bottom = hole.top + hole.height;
  const right = hole.left + hole.width;
  const block = 'absolute pointer-events-auto';
  return (
    <>
      <div className={block} style={{ left: 0, top: 0, width, height: Math.max(0, hole.top) }} />
      <div className={block} style={{ left: 0, top: bottom, width, height: Math.max(0, height - bottom) }} />
      <div className={block} style={{ left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height }} />
      <div className={block} style={{ left: right, top: hole.top, width: Math.max(0, width - right), height: hole.height }} />
    </>
  );
}

/** Flèche dessinée à la main : le trait se « dessine » à l'apparition. */
export function TourArrow({ arrow, stepKey }: { arrow: HandArrow; stepKey: string }) {
  const stroke = { stroke: '#FFF6E5', strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <svg className='absolute inset-0 w-full h-full pointer-events-none overflow-visible' aria-hidden='true'>
      <m.path
        key={`${stepKey}-d`} d={arrow.d} {...stroke}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
      />
      <m.path
        key={`${stepKey}-h`} d={arrow.head} {...stroke}
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.2, delay: 0.6 }}
      />
    </svg>
  );
}

interface BubbleProps {
  left: number;
  top: number;
  width: number;
  index: number;
  total: number;
  title: string;
  text: string;
  /** Étape « swipe » : sens déjà essayés. */
  chips?: { label: string; hint: string; done: boolean }[];
  action?: string;
  onAction: () => void;
  onSkip: () => void;
}

/** Bulle du tour : à la manière d'un sticker (crème, bord prune, ombre dure). */
export const TourBubble = forwardRef<HTMLDivElement, BubbleProps>(function TourBubble(
  { left, top, width, index, total, title, text, chips, action, onAction, onSkip },
  ref
) {
  return (
    <m.div
      ref={ref}
      key={title}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className='absolute pointer-events-auto bg-cream text-plum rounded-[22px] border-[3px] border-plum shadow-hard px-4 pt-2.5 pb-3'
      style={{ left, top, width }}
      role='group'
      aria-label={`Tutoriel, étape ${index + 1} sur ${total}`}
    >
      <div className='flex items-center justify-between'>
        <p className='text-[11px] font-black uppercase tracking-widest text-plum-muted'>Étape {index + 1}/{total}</p>
        {/* Toujours visible ; la zone de toucher dépasse la ligne sans agrandir la bulle. */}
        <button
          type='button' onClick={onSkip} aria-label='Passer le tuto'
          className='-my-2.5 -mr-2 px-2.5 py-2.5 min-h-[44px] text-xs font-bold text-plum-muted underline underline-offset-2'
        >
          Passer
        </button>
      </div>
      <div className='flex items-center justify-between gap-2 -mt-1'>
        <h2 className='font-display text-[21px] leading-tight min-w-0'>{title}</h2>
        {chips && (
          <div className='flex gap-1.5 shrink-0'>
            {chips.map(c => (
              <span
                key={c.label}
                title={c.hint}
                className={`chip !px-2 !py-0.5 !text-[13px] ${c.done ? 'bg-fooder-mint text-plum' : 'bg-white text-plum-muted'}`}
              >
                {c.label}
                {c.done && <Check className='w-3 h-3' strokeWidth={3.5} aria-hidden='true' />}
                <span className='sr-only'>{c.hint}{c.done ? ' : fait' : ''}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <p className='text-[13px] font-bold leading-snug mt-0.5 text-plum/80'>{text}</p>
      {action && (
        <div className='flex justify-end mt-2.5'>
          <button type='button' onClick={onAction} className='duo-button bg-bubblegum text-plum py-2 px-5 text-sm whitespace-nowrap'>
            {action}
          </button>
        </div>
      )}
    </m.div>
  );
});
