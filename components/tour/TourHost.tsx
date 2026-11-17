'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { track } from '../../lib/analytics';
import { awardXp } from '../../lib/rewards';
import {
  IDLE_TOUR, TOUR_STEPS, TOUR_XP, isTourActive, readTour, reduceTour, subscribeTour, tourStepId, writeTour,
  type TourEvent, type TourState,
} from '../../lib/tour';
import { arrowEnds, handArrow, padRect, placeBubble, unionRect, type Rect } from '../../lib/tourGeometry';
import { TourArrow, TourBlockers, TourBubble, TourDim } from './TourOverlay';
import { TourFinale } from './TourFinale';
import { tourStepView } from './tourCopy';

const PAD = 6;
const BUBBLE_MAX_W = 290;
/** Cible introuvable pendant ce délai (paquet vide, page lente) : l'étape est passée plutôt que de bloquer l'utilisateur. */
const MISSING_MS = 5000;

interface View {
  hole: Rect | null;
  w: number;
  h: number;
  bubbleH: number;
  /** Une feuille (fiche, envies, conditions…) est ouverte : le tour s'efface le temps qu'elle l'est. */
  blocked: boolean;
}

const INITIAL_VIEW: View = { hole: null, w: 0, h: 0, bubbleH: 150, blocked: false };

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function readHole(selectors: string[], origin: DOMRect): Rect | null {
  const rects = selectors
    .flatMap(sel => Array.from(document.querySelectorAll<HTMLElement>(sel), el => el.getBoundingClientRect()))
    .filter(r => r.width > 0 && r.height > 0)
    .map(r => ({ left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height }));
  return unionRect(rects);
}

/**
 * Hôte du tour guidé, monté dans la coque de l'appli : assombrit l'écran, éclaire l'élément de l'étape,
 * y pointe une flèche dessinée à la main et attend le geste de l'utilisateur (jamais un verdict imposé).
 */
export function TourHost() {
  const pathname = usePathname();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<TourState>(IDLE_TOUR);
  const [state, setState] = useState<TourState>(IDLE_TOUR);
  const [finale, setFinale] = useState(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);

  const apply = useCallback((e: TourEvent) => {
    const prev = stateRef.current;
    const next = reduceTour(prev, e);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    writeTour(next);
    if (e.type === 'start') track('tour_started');
    if (next.status === 'skipped') track('tour_skipped', { step: TOUR_STEPS[prev.step] });
    else if (next.status === 'done' && prev.status === 'active') {
      track('tour_done');
      awardXp(TOUR_XP, 'other');
      setFinale(true);
    } else if (next.step !== prev.step) track('tour_step', { step: TOUR_STEPS[next.step] });
  }, []);

  useEffect(() => {
    const saved = readTour();
    stateRef.current = saved;
    setState(saved);
    return subscribeTour(apply);
  }, [apply]);

  useEffect(() => {
    apply({ type: 'route', path: pathname });
  }, [pathname, apply]);

  const active = isTourActive(state);
  const step = tourStepId(state);

  // Les deux premières étapes se jouent sur Découvrir : on y ramène l'utilisateur s'il en est sorti.
  useEffect(() => {
    if (active && (step === 'mood' || step === 'swipe') && pathname !== '/swipe') router.replace('/swipe');
  }, [active, step, pathname, router]);

  // Suit la cible à chaque image : la mise en page bouge (animations, clavier, rotation, 320 px).
  useEffect(() => {
    if (!active) return;
    const targets = tourStepView(step, state).targets;
    let raf = 0;
    let missingSince: number | null = null;
    const tick = (now: number) => {
      const root = rootRef.current;
      if (root) {
        const origin = root.getBoundingClientRect();
        const blocked = document.querySelector('[role="dialog"]') !== null;
        const hole = readHole(targets, origin);
        const bubbleH = bubbleRef.current?.offsetHeight || 0;
        setView(prev => {
          const next: View = { hole, w: Math.round(origin.width), h: Math.round(origin.height), bubbleH: bubbleH || prev.bubbleH, blocked };
          const same = sameRect(prev.hole, next.hole) && prev.w === next.w && prev.h === next.h && prev.bubbleH === next.bubbleH && prev.blocked === next.blocked;
          return same ? prev : next;
        });
        if (!blocked && hole === null) {
          missingSince ??= now;
          if (now - missingSince > MISSING_MS) {
            missingSince = null;
            apply({ type: 'skipStep' });
          }
        } else missingSince = null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `state` entier n'est pas une dépendance : seuls l'étape et le temps « favoris » changent les cibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, state.favoritesOpened, apply]);

  if (finale) {
    return (
      <TourFinale
        onClose={() => {
          setFinale(false);
          if (pathname !== '/swipe') router.push('/swipe');
        }}
      />
    );
  }
  if (!active) return null;

  const content = tourStepView(step, state);
  const hole = view.hole ? padRect(view.hole, PAD) : null;
  const bw = Math.max(200, Math.min(BUBBLE_MAX_W, view.w - 24));
  const place = hole ? placeBubble(hole, { w: view.w, h: view.h }, { w: bw, h: view.bubbleH }) : null;
  const ends = hole && place ? arrowEnds(hole, { left: place.left, top: place.top, width: bw, height: view.bubbleH }, place.side) : null;
  const arrow = ends ? handArrow(ends.from, ends.to) : null;
  const shown = !view.blocked && hole !== null && place !== null && view.w > 0;

  return (
    <div
      ref={rootRef}
      className='absolute inset-0 z-[100] pointer-events-none'
      style={{ visibility: shown ? 'visible' : 'hidden' }}
      role='region'
      aria-label='Tutoriel'
    >
      {shown && (
        <>
          <TourDim hole={hole} width={view.w} height={view.h} />
          <TourBlockers hole={hole} width={view.w} height={view.h} />
          {arrow && <TourArrow arrow={arrow} stepKey={`${step}-${state.favoritesOpened}`} />}
          <TourBubble
            ref={bubbleRef}
            left={place.left}
            top={place.top}
            width={bw}
            index={TOUR_STEPS.indexOf(step)}
            total={TOUR_STEPS.length}
            title={content.title}
            text={content.text}
            chips={step === 'swipe' ? [{ label: '←', hint: 'Pas envie', done: state.left }, { label: '→', hint: 'Envie', done: state.right }] : undefined}
            action={content.action}
            onAction={() => apply({ type: 'next' })}
            onSkip={() => apply({ type: 'skip' })}
          />
        </>
      )}
    </div>
  );
}
