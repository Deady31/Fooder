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
const VISIBLE_DEPTH = 3;

const cardVariants = {
  exit: (dir: SwipeDir) => ({
    x: dir === 'right' ? 620 : -620,
    rotate: dir === 'right' ? 26 : -26,
    opacity: 0,
    transition: { duration: 0.34, ease: 'easeIn' as const },
  }),
};

interface TopCardProps {
  rest: Restaurant;
  onCommit: (dir: SwipeDir) => void;
  onOpen: (rest: Restaurant) => void;
}

const HOLD_MS = 1000;
const MOVE_TOLERANCE = 14;

function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

function TopCard({ rest, onCommit, onOpen }: TopCardProps) {
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
    if (pressStart.current !== null && Math.hypot(info.offset.x, info.offset.y) > MOVE_TOLERANCE) release(false);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    release(false);
    if (info.offset.x > COMMIT_OFFSET || info.velocity.x > COMMIT_VELOCITY) onCommit('right');
    else if (info.offset.x < -COMMIT_OFFSET || info.velocity.x < -COMMIT_VELOCITY) onCommit('left');
  };

  return (
    <motion.div
      className='absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y select-none'
      style={{ x, rotate, zIndex: 30, WebkitTouchCallout: 'none' }}
      drag='x'
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
      <motion.div className='w-full h-full' style={{ scale: pressScale }}>
        <RestaurantCard rest={rest} hold={hold} nudge={nudge} />
      </motion.div>

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
    </motion.div>
  );
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { cards, canSwipe, onSwipe, onOpen, onBlocked },
  ref
) {
  const [exitDir, setExitDir] = useState<SwipeDir>('right');

  const commit = (dir: SwipeDir) => {
    const top = cards[cards.length - 1];
    if (!top) return;
    if (!canSwipe) {
      onBlocked();
      return;
    }
    setExitDir(dir);
    onSwipe(dir, top, cards.length - 1);
  };

  useImperativeHandle(ref, () => ({ swipe: commit }));

  const visible = cards.slice(-VISIBLE_DEPTH);

  return (
    <div className='relative w-[92%] h-[62vh] max-h-[560px]'>
      <AnimatePresence custom={exitDir}>
        {visible.map((rest, i) => {
          const depth = visible.length - 1 - i;
          if (depth === 0) {
            return <TopCard key={rest.id} rest={rest} onCommit={commit} onOpen={onOpen} />;
          }
          return (
            <motion.div
              key={rest.id}
              className='absolute inset-0 pointer-events-none'
              style={{ zIndex: 30 - depth }}
              initial={false}
              animate={{ scale: 1 - depth * 0.05, y: depth * 16, rotate: depth % 2 ? 1.5 : -1.5 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <RestaurantCard rest={rest} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
