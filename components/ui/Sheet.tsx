'use client';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo, type Transition } from 'framer-motion';
import { DUR, SPRING, reducedMotion } from '../../lib/motion';

/* ────────────────────────────────────────────────────────────────────────────
 * Logique pure (exportée pour les tests, aucune dépendance au DOM).
 * ──────────────────────────────────────────────────────────────────────────── */

export type SheetVariant = 'bottom' | 'full' | 'top';
export type KeyAction = 'close' | 'tab' | 'shift-tab' | 'none';

/** Clé d'état d'historique réservée aux feuilles (valeur = identifiant de l'instance). */
export const SHEET_HISTORY_KEY = 'fooderSheet';

const DRAG_MIN = 80;
const DRAG_MAX = 160;
const FLICK_VELOCITY = 600;
const FLICK_MIN_OFFSET = 20;

/**
 * Index à focaliser après Tab / Shift+Tab dans une feuille de `count` éléments
 * focalisables ; `current` = index de l'élément actif (-1 s'il est hors feuille).
 * Renvoie -1 s'il n'y a aucun élément.
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}

/** Interprète une touche du clavier. */
export function keyAction(key: string, shift: boolean): KeyAction {
  if (key === 'Escape') return 'close';
  if (key === 'Tab') return shift ? 'shift-tab' : 'tab';
  return 'none';
}

/** Un tap sur le fond ferme seulement si l'option est active et que le fond lui-même est visé. */
export function shouldCloseOnBackdrop(dismissOnBackdrop: boolean, targetIsBackdrop: boolean): boolean {
  return dismissOnBackdrop && targetIsBackdrop;
}

/**
 * Décide, à la fin d'un glissement vers le bas, si la feuille se ferme.
 * Seuil = 25 % de la hauteur, borné entre 80 et 160 px ; un geste rapide
 * (> 600 px/s, au moins 20 px) ferme aussi. Vers le haut ou valeurs invalides : reste.
 */
export function dragCloseDecision(p: { offsetY: number; velocityY: number; height: number }): 'close' | 'stay' {
  const { offsetY, velocityY, height } = p;
  if (!Number.isFinite(offsetY) || !Number.isFinite(velocityY) || !Number.isFinite(height)) return 'stay';
  if (offsetY <= 0) return 'stay';
  const threshold = Math.min(DRAG_MAX, Math.max(DRAG_MIN, height * 0.25));
  if (offsetY > threshold) return 'close';
  return velocityY > FLICK_VELOCITY && offsetY >= FLICK_MIN_OFFSET ? 'close' : 'stay';
}

export interface SheetMotion {
  initial: Record<string, number | string>;
  animate: Record<string, number | string>;
  exit: Record<string, number | string>;
  transition: Transition;
}

/** États d'animation d'entrée / sortie du panneau ; fondu seul en mouvement réduit. */
export function sheetMotion(variant: SheetVariant, reduced: boolean | null | undefined): SheetMotion {
  if (reduced) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } };
  }
  const transition = reducedMotion<Transition>(SPRING.soft, false);
  if (variant === 'full') {
    return {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 24 },
      transition,
    };
  }
  const off = variant === 'top' ? '-100%' : '100%';
  return { initial: { y: off }, animate: { y: 0 }, exit: { y: off }, transition };
}

/** Abstraction minimale de window.history (injectable pour les tests). */
export interface HistoryEnv {
  getState: () => Record<string, unknown> | null;
  pushState: (state: Record<string, unknown>) => void;
  back: () => void;
  addPopListener: (listener: () => void) => void;
  removePopListener: (listener: () => void) => void;
}

export interface HistoryGuard {
  /** Demande la fermeture : retire notre entrée d'historique (popstate → onClose) ou appelle onClose. */
  close: () => void;
  /** Libère l'écouteur et retire notre entrée si la feuille n'est plus ouverte. */
  dispose: () => void;
}

/** HistoryEnv branché sur window (navigateur uniquement). */
export function browserHistoryEnv(): HistoryEnv {
  const map = new Map<() => void, () => void>();
  return {
    getState: () => (window.history.state as Record<string, unknown> | null) ?? null,
    pushState: (s) => window.history.pushState(s, ''),
    back: () => window.history.back(),
    addPopListener: (l) => {
      window.addEventListener('popstate', l);
      map.set(l, l);
    },
    removePopListener: (l) => {
      window.removeEventListener('popstate', l);
      map.delete(l);
    },
  };
}

/**
 * Gère l'entrée d'historique d'une feuille (geste retour Android / bouton navigateur).
 * - une seule entrée par instance (`id`), même après un re-montage StrictMode ;
 * - popstate : ferme sauf si l'entrée courante est encore la nôtre (feuilles imbriquées) ;
 * - dispose : le retrait différé de l'entrée n'a lieu que si `stillOpen()` est faux
 *   (distingue un vrai démontage d'un re-montage), et seulement si l'entrée est la nôtre.
 */
export function createHistoryGuard(
  env: HistoryEnv,
  id: string,
  onClose: () => void,
  stillOpen: () => boolean,
  schedule: (fn: () => void) => void = (fn) => void setTimeout(fn, 0),
): HistoryGuard {
  const isMine = () => env.getState()?.[SHEET_HISTORY_KEY] === id;
  if (!isMine()) env.pushState({ ...(env.getState() ?? {}), [SHEET_HISTORY_KEY]: id });

  const onPop = () => {
    if (!isMine()) onClose();
  };
  env.addPopListener(onPop);

  return {
    close: () => (isMine() ? env.back() : onClose()),
    dispose: () => {
      env.removePopListener(onPop);
      schedule(() => {
        if (!stillOpen() && isMine()) env.back();
      });
    },
  };
}

/** Verrou de défilement à compteur : restaure la valeur d'origine au dernier déverrouillage. */
export function createScrollLock(body: { style: { overflow: string } }): () => () => void {
  let count = 0;
  let saved = '';
  return () => {
    if (count === 0) {
      saved = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    count++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      count--;
      if (count === 0) body.style.overflow = saved;
    };
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Composant
 * ──────────────────────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Pile des feuilles ouvertes : seule celle du dessus réagit au clavier. */
const openStack: string[] = [];
let scrollLock: (() => () => void) | null = null;

const CONTAINER: Record<SheetVariant, string> = {
  bottom: 'items-end justify-center p-3 pb-[max(env(safe-area-inset-bottom),12px)]',
  top: 'items-start justify-center p-3 pt-[max(env(safe-area-inset-top),12px)]',
  full: '',
};
const PANEL: Record<SheetVariant, string> = {
  bottom: 'w-full max-w-md max-h-[90dvh]',
  top: 'w-full max-w-md max-h-[90dvh]',
  full: 'w-full h-full',
};

export interface SheetProps {
  /** Affiche la feuille. Passer à `false` déclenche l'animation de sortie. */
  open: boolean;
  /** Appelé quand l'utilisateur ferme (Échap, retour, fond, glissement). Le parent doit passer `open` à false. */
  onClose: () => void;
  /** id de l'élément qui donne son titre à la feuille (aria-labelledby). */
  labelledBy: string;
  /** id d'un texte descriptif (aria-describedby), optionnel. */
  describedBy?: string;
  /** 'bottom' (défaut) : feuille du bas ; 'full' : plein écran ; 'top' : depuis le haut. */
  variant?: SheetVariant;
  /** Tap sur le fond = fermer (défaut true). */
  dismissOnBackdrop?: boolean;
  /** Poignée + glisser vers le bas pour fermer, variant 'bottom' uniquement (défaut true). */
  draggable?: boolean;
  /** Élément à focaliser à l'ouverture (défaut : premier élément focalisable). */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Classes du panneau (fond, bordures, arrondis…). */
  className?: string;
  /** z-index (défaut 150, comme les feuilles actuelles ; la Lightbox doit rester au-dessus). */
  zIndex?: number;
  children: ReactNode;
}

/**
 * Feuille modale accessible rendue dans un portail.
 *
 * ```tsx
 * <Sheet open={open} onClose={() => setOpen(false)} labelledBy='filtres-titre'>
 *   <h2 id='filtres-titre'>Filtres</h2>
 * </Sheet>
 * ```
 *
 * Fournit : role="dialog" + aria-modal, piège de focus, Échap, geste retour
 * (une entrée d'historique, retirée à la fermeture), retour du focus au
 * déclencheur, blocage du défilement de l'arrière-plan, animation d'entrée et
 * de sortie, prefers-reduced-motion respecté.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  describedBy,
  variant = 'bottom',
  dismissOnBackdrop = true,
  draggable = true,
  initialFocusRef,
  className = '',
  zIndex = 150,
  children,
}: SheetProps) {
  const reduced = useReducedMotion();
  const id = useId();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const guardRef = useRef<HistoryGuard | null>(null);
  const activeRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dragControls = useDragControls();

  useEffect(() => setMounted(true), []);

  const active = open && mounted;

  useEffect(() => {
    if (!active) return;
    activeRef.current = true;
    const previous = document.activeElement as HTMLElement | null;

    const guard = createHistoryGuard(browserHistoryEnv(), id, () => onCloseRef.current(), () => activeRef.current);
    guardRef.current = guard;

    openStack.push(id);
    scrollLock ??= createScrollLock(document.body);
    const unlock = scrollLock();

    const panel = panelRef.current;
    const items = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (initialFocusRef?.current ?? items()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      const action = keyAction(e.key, e.shiftKey);
      if (action === 'close') {
        e.preventDefault();
        guard.close();
      } else if (action === 'tab' || action === 'shift-tab') {
        const list = items();
        e.preventDefault();
        const i = nextFocusIndex(list.length, list.indexOf(document.activeElement as HTMLElement), action === 'shift-tab');
        (i < 0 ? panel : list[i])?.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      activeRef.current = false;
      document.removeEventListener('keydown', onKey);
      const at = openStack.lastIndexOf(id);
      if (at >= 0) openStack.splice(at, 1);
      unlock();
      guard.dispose();
      guardRef.current = null;
      previous?.focus?.();
    };
    // initialFocusRef est lu une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id]);

  const requestClose = useCallback(() => {
    if (guardRef.current) guardRef.current.close();
    else onCloseRef.current();
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const height = panelRef.current?.getBoundingClientRect().height ?? 0;
    if (dragCloseDecision({ offsetY: info.offset.y, velocityY: info.velocity.y, height }) === 'close') requestClose();
  };

  if (!mounted) return null;

  const m = sheetMotion(variant, reduced);
  const canDrag = draggable && variant === 'bottom' && !reduced;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key='sheet' className={`fixed inset-0 flex ${CONTAINER[variant]}`} style={{ zIndex }}>
          <motion.div
            aria-hidden='true'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : DUR.base }}
            onClick={(e) => {
              if (shouldCloseOnBackdrop(dismissOnBackdrop, e.target === e.currentTarget)) requestClose();
            }}
            className='absolute inset-0 bg-plum/60 backdrop-blur-sm'
          />
          <motion.div
            ref={panelRef}
            role='dialog'
            aria-modal='true'
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            initial={m.initial}
            animate={m.animate}
            exit={m.exit}
            transition={m.transition}
            drag={canDrag ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            className={`relative overflow-y-auto overscroll-contain outline-none ${PANEL[variant]} ${className}`}
          >
            {canDrag && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                aria-hidden='true'
                className='flex justify-center pt-2 pb-1 cursor-grab'
                style={{ touchAction: 'none' }}
              >
                <span className='block w-10 h-1.5 rounded-full bg-plum/30' />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
