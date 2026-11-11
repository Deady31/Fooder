'use client';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { AnimatePresence, motion, MotionValue, PanInfo, useMotionValue, useTransform } from 'framer-motion';
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

function TopCard({ rest, onCommit, onOpen }: TopCardProps) {
  const x: MotionValue<number> = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);
  const likeScale = useTransform(x, [30, 130], [0.6, 1.08]);
  const nopeScale = useTransform(x, [-130, -30], [1.08, 0.6]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > COMMIT_OFFSET || info.velocity.x > COMMIT_VELOCITY) onCommit('right');
    else if (info.offset.x < -COMMIT_OFFSET || info.velocity.x < -COMMIT_VELOCITY) onCommit('left');
  };

  return (
    <motion.div
      className='absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y'
      style={{ x, rotate, zIndex: 30 }}
      drag='x'
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      onTap={() => onOpen(rest)}
      variants={cardVariants}
      exit='exit'
      whileTap={{ scale: 0.985 }}
    >
      <RestaurantCard rest={rest} />

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
