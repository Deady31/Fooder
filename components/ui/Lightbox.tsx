'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Point,
  Size,
  LIGHTBOX_Z_INDEX,
  clampPan,
  clampZoom,
  containedSize,
  distance,
  doubleTapZoom,
  gestureDecision,
  pinchZoom,
  wheelZoom,
} from './lightboxMath';

interface LightboxProps {
  images: string[];
  index: number;
  alt: string;
  /** Ligne de crédit affichée en bas (déjà formatée), ou absente. */
  credit?: string | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

const HISTORY_KEY = 'fooderLightbox';
const TAP_MOVE = 8;
const TAP_TIME = 300;

interface Gesture {
  pan: Point;
  point: Point;
  zoom: number;
  dist: number;
  time: number;
  moved: number;
}

export function Lightbox({ images, index, alt, credit, onIndexChange, onClose }: LightboxProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState<Size>({ w: 0, h: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const gesture = useRef<Gesture>({ pan: { x: 0, y: 0 }, point: { x: 0, y: 0 }, zoom: 1, dist: 0, time: 0, moved: 0 });
  const lastTap = useRef<{ time: number; point: Point } | null>(null);
  const lastMove = useRef<{ time: number; x: number; vx: number }>({ time: 0, x: 0, vx: 0 });
  const mountedRef = useRef(false);

  const count = images.length;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0));

  useEffect(() => setMounted(true), []);

  // Historique : le bouton retour ferme la visionneuse, pas la fiche.
  useEffect(() => {
    mountedRef.current = true;
    if (!window.history.state?.[HISTORY_KEY]) {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_KEY]: true }, '');
    }
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('popstate', onPop);
      // Démontage réel (pas un re-montage StrictMode) : on retire notre entrée.
      setTimeout(() => {
        if (!mountedRef.current && window.history.state?.[HISTORY_KEY]) window.history.back();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    if (window.history.state?.[HISTORY_KEY]) window.history.back();
    else onClose();
  }, [onClose]);

  // Focus : prise à l'ouverture, restitution à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDrag({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, []);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to > count - 1 || to === safeIndex) return;
      resetView();
      onIndexChange(to);
    },
    [count, safeIndex, onIndexChange, resetView],
  );

  useEffect(() => {
    // Phase de capture + stopPropagation : si la visionneuse s'ouvre au-dessus d'une feuille (fiche resto),
    // Échap, Tab et les flèches ne doivent agir que sur la visionneuse, pas fermer la feuille dessous.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        go(safeIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        go(safeIndex - 1);
      } else if (e.key === 'Tab') {
        e.stopPropagation();
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
        if (items.length === 0) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [requestClose, go, safeIndex]);

  const boxSize = (): Size => {
    const r = stageRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  };

  // Molette (écouteur natif non passif pour pouvoir bloquer le défilement).
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const naturalRef = useRef(natural);
  naturalRef.current = natural;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = wheelZoom(zoomRef.current, e.deltaY);
      const box = boxSize();
      setZoom(next);
      setPan((p) => clampPan(p, next, containedSize(naturalRef.current, box), box));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mounted]);

  const rebase = () => {
    const pts = Array.from(pointers.current.values());
    gesture.current = {
      ...gesture.current,
      pan,
      zoom,
      point: pts[0] ?? gesture.current.point,
      dist: pts.length >= 2 ? distance(pts[0], pts[1]) : 0,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { ...gesture.current, time: Date.now(), moved: 0 };
      lastMove.current = { time: Date.now(), x: e.clientX, vx: 0 };
    } else {
      gesture.current = { ...gesture.current, moved: TAP_MOVE + 1 };
    }
    rebase();
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());
    const box = boxSize();
    const img = containedSize(natural, box);
    const g = gesture.current;

    if (pts.length >= 2) {
      const next = pinchZoom(g.zoom, g.dist, distance(pts[0], pts[1]));
      setZoom(next);
      setPan(clampPan(pan, next, img, box));
      g.moved = TAP_MOVE + 1;
      return;
    }
    const dx = e.clientX - g.point.x;
    const dy = e.clientY - g.point.y;
    g.moved = Math.max(g.moved, Math.hypot(dx, dy));
    const now = Date.now();
    const dt = now - lastMove.current.time;
    if (dt > 0) lastMove.current = { time: now, x: e.clientX, vx: (e.clientX - lastMove.current.x) / dt };
    if (zoom > 1) setPan(clampPan({ x: g.pan.x + dx, y: g.pan.y + dy }, zoom, img, box));
    else setDrag({ x: dx, y: dy });
  };

  const hitsImage = (p: Point): boolean => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return true;
    const img = containedSize(natural, { w: r.width, h: r.height });
    const cx = r.left + r.width / 2 + pan.x;
    const cy = r.top + r.height / 2 + pan.y;
    return Math.abs(p.x - cx) <= (img.w * zoom) / 2 && Math.abs(p.y - cy) <= (img.h * zoom) / 2;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (!wasSingle) {
      rebase();
      return;
    }
    setDragging(false);
    const g = gesture.current;
    const point = { x: e.clientX, y: e.clientY };
    const isTap = e.type === 'pointerup' && g.moved <= TAP_MOVE && Date.now() - g.time < TAP_TIME;

    if (isTap) {
      setDrag({ x: 0, y: 0 });
      const prev = lastTap.current;
      if (prev && Date.now() - prev.time < TAP_TIME && distance(prev.point, point) < 30) {
        lastTap.current = null;
        const next = doubleTapZoom(zoom);
        setZoom(next);
        setPan((p) => (next === 1 ? { x: 0, y: 0 } : p));
      } else {
        lastTap.current = { time: Date.now(), point };
        if (!hitsImage(point)) requestClose();
      }
      return;
    }

    const outcome = gestureDecision({
      dx: drag.x,
      dy: drag.y,
      zoom,
      width: boxSize().w,
      index: safeIndex,
      count,
      vx: lastMove.current.vx,
    });
    setDrag({ x: 0, y: 0 });
    if (outcome === 'close') requestClose();
    else if (outcome === 'next') go(safeIndex + 1);
    else if (outcome === 'prev') go(safeIndex - 1);
  };

  if (!mounted || count === 0) return null;

  const transition = dragging || reduced ? 'none' : 'transform 200ms ease-out';
  const tx = pan.x + drag.x;
  const ty = pan.y + drag.y;
  const fade = zoom === 1 && drag.y > 0 ? Math.max(0.35, 1 - drag.y / 400) : 1;

  return createPortal(
    <motion.div
      ref={rootRef}
      role='dialog'
      aria-modal='true'
      aria-label={`Photo ${safeIndex + 1} sur ${count} : ${alt}`}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      onClick={(e) => e.stopPropagation()}
      className='fixed inset-0 bg-black/90 select-none'
      style={{ zIndex: LIGHTBOX_Z_INDEX }}
    >
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => e.preventDefault()}
        className='absolute inset-0 overflow-hidden'
        style={{ touchAction: 'none', cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[safeIndex]}
          src={images[safeIndex]}
          alt={alt}
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className='w-full h-full object-contain pointer-events-none'
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${clampZoom(zoom)})`,
            transition,
            opacity: fade,
          }}
        />
      </div>

      <button
        ref={closeBtnRef}
        onClick={requestClose}
        aria-label='Fermer la photo'
        className='absolute top-[max(env(safe-area-inset-top),16px)] right-4 w-12 h-12 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 transition-transform'
      >
        <X className='w-5 h-5 text-plum' strokeWidth={3} />
      </button>

      {count > 1 && (
        <>
          <div
            aria-live='polite'
            className='absolute top-[max(env(safe-area-inset-top),16px)] left-4 h-12 px-4 flex items-center rounded-full bg-white/90 border-[3px] border-plum text-plum text-sm font-bold tabular-nums'
          >
            {safeIndex + 1} / {count}
          </div>
          {safeIndex > 0 && (
            <button
              onClick={() => go(safeIndex - 1)}
              aria-label='Photo précédente'
              className='hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white border-[3px] border-plum rounded-full items-center justify-center shadow-hard'
            >
              <ChevronLeft className='w-6 h-6 text-plum' strokeWidth={3} />
            </button>
          )}
          {safeIndex < count - 1 && (
            <button
              onClick={() => go(safeIndex + 1)}
              aria-label='Photo suivante'
              className='hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white border-[3px] border-plum rounded-full items-center justify-center shadow-hard'
            >
              <ChevronRight className='w-6 h-6 text-plum' strokeWidth={3} />
            </button>
          )}
        </>
      )}

      {credit && (
        <p className='absolute bottom-0 inset-x-0 px-5 pt-6 pb-[max(env(safe-area-inset-bottom),16px)] text-center text-xs font-semibold text-white/90 bg-gradient-to-t from-black/70 to-transparent pointer-events-none'>
          {credit}
        </p>
      )}
    </motion.div>,
    document.body,
  );
}
