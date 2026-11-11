'use client';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence, animate, AnimationPlaybackControls, motion, MotionValue, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Restaurant } from '../../data/mockRestaurants';
import { RestaurantCard } from './RestaurantCard';

export type SwipeDir = 'left' | 'right';

export interface SwipeDeckHandle {
  swipe: (dir: SwipeDir) => void;
}

interface SwipeDeckProps {
  cards: Restaurant[];
  canSwipe: boolean;
  onSwipe: (dir: SwipeDir, rest: Restaurant, index: number) => void;
  onOpen: (rest: Restaurant) => void;
  onBlocked: () => void;
}

const COMMIT_OFFSET = 110;
const COMMIT_VELOCITY = 600;
const PEEK_OFFSET = 36; // à partir de là, la carte du dessous commence à avancer
const VISIBLE_DEPTH = 3;
const HOLD_MS = 1000;
const MOVE_TOLERANCE = 14;

const STACK_SPRING = { type: 'spring' as const, stiffness: 290, damping: 28, mass: 0.9 };
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// La carte qui part continue sur sa lancée (ease-out), puis s'efface : pas de démarrage mou.
const cardVariants = {
  exit: (dir: SwipeDir) => ({
    x: dir === 'right' ? 760 : -760,
    y: 36,
    rotate: dir === 'right' ? 22 : -22,
    opacity: 0,
    transition: {
      x: { duration: 0.46, ease: EASE_OUT_EXPO },
      y: { duration: 0.46, ease: EASE_OUT_EXPO },
      rotate: { duration: 0.46, ease: EASE_OUT_EXPO },
      opacity: { duration: 0.26, delay: 0.14, ease: 'easeIn' as const },
    },
  }),
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

/** Position cible d'une carte selon sa profondeur ; « peeking » fait avancer la carte juste derrière. */
function stackTarget(depth: number, peeking: boolean) {
  if (depth === 0) return { scale: 1, y: 0, rotate: 0 };
  const e = peeking && depth === 1 ? 0.55 : depth;
  return { scale: 1 - e * 0.05, y: e * 16, rotate: (depth % 2 ? 1.5 : -1.5) * Math.min(1, e) };
}

interface DeckCardProps {
  rest: Restaurant;
  depth: number;
  entering: boolean;
  peeking: boolean;
  onCommit: (dir: SwipeDir) => void;
  onOpen: (rest: Restaurant) => void;
  onPeek: (peeking: boolean) => void;
}

function DeckCard({ rest, depth, entering, peeking, onCommit, onOpen, onPeek }: DeckCardProps) {
  const isTop = depth === 0;

  const x: MotionValue<number> = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);
  const likeScale = useTransform(x, [30, 130], [0.6, 1.08]);
  const nopeScale = useTransform(x, [-130, -30], [1.08, 0.6]);

  const hold = useMotionValue(0);
  const dip = useMotionValue(0);
  const pressScale = useTransform([hold, dip], ([h, d]: number[]) => 1 - 0.015 * d - 0.035 * h);
  const holdControls = useRef<AnimationPlaybackControls | null>(null);
  const pressStart = useRef<number | null>(null);
  const [nudge, setNudge] = useState(0);

  const release = (tooQuick: boolean) => {
    holdControls.current?.stop();
    holdControls.current = null;
    pressStart.current = null;
    animate(hold, 0, { duration: 0.2, ease: 'easeOut' });
    animate(dip, 0, { type: 'spring', stiffness: 500, damping: 24 });
    if (tooQuick) {
      setNudge(n => n + 1);
      buzz(12);
    }
  };

  const handlePointerDown = () => {
    if (!isTop) return;
    pressStart.current = Date.now();
    buzz(8);
    animate(dip, 1, { type: 'spring', stiffness: 700, damping: 26 });
    holdControls.current = animate(hold, 1, {
      duration: HOLD_MS / 1000,
      ease: 'linear',
      onComplete: () => {
        holdControls.current = null;
        pressStart.current = null;
        buzz([25, 30, 45]);
        onOpen(rest);
        setTimeout(() => {
          animate(hold, 0, { duration: 0.3 });
          animate(dip, 0, { type: 'spring', stiffness: 500, damping: 24 });
        }, 250);
      },
    });
  };

  const handlePointerUp = () => {
    if (pressStart.current === null) return;
    release(Date.now() - pressStart.current < HOLD_MS * 0.6);
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    const dist = Math.hypot(info.offset.x, info.offset.y);
    if (pressStart.current !== null && dist > MOVE_TOLERANCE) release(false);
    onPeek(Math.abs(info.offset.x) > PEEK_OFFSET);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    release(false);
    if (info.offset.x > COMMIT_OFFSET || info.velocity.x > COMMIT_VELOCITY) onCommit('right');
    else if (info.offset.x < -COMMIT_OFFSET || info.velocity.x < -COMMIT_VELOCITY) onCommit('left');
    else onPeek(false);
  };

  const target = stackTarget(depth, peeking);
  const from = stackTarget(depth + 1, false);

  return (
    <motion.div
      className={`absolute inset-0 select-none ${isTop ? 'cursor-grab active:cursor-grabbing touch-pan-y' : 'pointer-events-none'}`}
      style={{ x, rotate, zIndex: 30 - depth, WebkitTouchCallout: 'none' }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => release(false)}
      onContextMenu={e => e.preventDefault()}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      variants={cardVariants}
      exit='exit'
    >
      <motion.div
        className='w-full h-full'
        initial={entering ? { ...from, opacity: 0 } : false}
        animate={{ ...target, opacity: 1 }}
        transition={{ ...STACK_SPRING, opacity: { duration: 0.25 } }}
      >
        <motion.div className='w-full h-full' style={{ scale: isTop ? pressScale : 1 }}>
          <RestaurantCard rest={rest} hold={isTop ? hold : undefined} nudge={isTop ? nudge : undefined} />
        </motion.div>
      </motion.div>

      {isTop && (
        <>
          <motion.div
            className='absolute top-8 left-5 z-20 pointer-events-none'
            style={{ opacity: likeOpacity, scale: likeScale, rotate: -14 }}
          >
            <div className='stamp text-[#12B76A]'>MIAM !</div>
          </motion.div>
          <motion.div
            className='absolute top-8 right-5 z-20 pointer-events-none'
            style={{ opacity: nopeOpacity, scale: nopeScale, rotate: 14 }}
          >
            <div className='stamp text-fooder-red'>BOF</div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { cards, canSwipe, onSwipe, onOpen, onBlocked },
  ref
) {
  const [exitDir, setExitDir] = useState<SwipeDir>('right');
  const [peeking, setPeeking] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  const commit = (dir: SwipeDir) => {
    const top = cards[cards.length - 1];
    if (!top) return;
    setPeeking(false);
    if (!canSwipe) {
      onBlocked();
      return;
    }
    setExitDir(dir);
    onSwipe(dir, top, cards.length - 1);
  };

  useImperativeHandle(ref, () => ({ swipe: commit }));

  const visible = cards.slice(-VISIBLE_DEPTH);

  // Les cartes présentes dès le premier rendu n'animent pas leur entrée ; les suivantes remontent doucement.
  const firstRender = seen.current === null;
  if (seen.current === null) seen.current = new Set();
  const known = seen.current;
  const entering = (id: string) => !firstRender && !known.has(id);
  const flags = visible.map(r => entering(r.id));
  visible.forEach(r => known.add(r.id));

  return (
    <div className='relative w-[92%] self-stretch mb-9 max-h-[640px]'>
      <AnimatePresence custom={exitDir}>
        {visible.map((rest, i) => (
          <DeckCard
            key={rest.id}
            rest={rest}
            depth={visible.length - 1 - i}
            entering={flags[i]}
            peeking={peeking}
            onCommit={commit}
            onOpen={onOpen}
            onPeek={setPeeking}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});
