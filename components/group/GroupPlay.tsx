'use client';
import { useMemo, useRef, useState } from 'react';
import { Restaurant } from '../../data/mockRestaurants';
import { SwipeDeck, SwipeDeckHandle, SwipeDir } from '../swipe/SwipeDeck';
import { ActionButtons } from '../swipe/ActionButtons';
import { GroupSession } from '../../lib/social/group';

interface GroupPlayProps {
  session: GroupSession;
  onDone: (likes: string[]) => void;
}

/** Mini-deck de la session : mêmes cartes pour tout le monde. */
export function GroupPlay({ session, onDone }: GroupPlayProps) {
  const cards = useMemo<Restaurant[]>(
    () =>
      session.restos
        .map(r => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine || 'Restaurant',
          rating: 0,
          price: 0,
          distance: r.quartier ?? 'Toulouse',
          image: '',
          address: r.quartier ? `${r.quartier}, Toulouse` : 'Toulouse',
          description: `Proposé par ${session.host.name} pour « ${session.title} ».`,
        }))
        .reverse(),
    [session]
  );
  const [index, setIndex] = useState(cards.length - 1);
  const likes = useRef<string[]>([]);
  const deckRef = useRef<SwipeDeckHandle>(null);

  const swiped = (dir: SwipeDir, rest: Restaurant, i: number) => {
    if (dir === 'right') likes.current = [...likes.current, rest.id];
    if (navigator.vibrate) navigator.vibrate(dir === 'right' ? 40 : 15);
    setIndex(i - 1);
    if (i - 1 < 0) setTimeout(() => onDone(likes.current), 380);
  };

  const done = cards.length - 1 - index;

  return (
    <div className='flex flex-col h-full min-h-0'>
      <p className='text-center text-xs font-black text-plum/60 py-2'>
        {Math.min(done + 1, cards.length)} / {cards.length} · swipe à droite ce qui te tente
      </p>
      <div className='flex-1 min-h-0 flex justify-center items-stretch'>
        <SwipeDeck ref={deckRef} cards={cards.slice(0, index + 1)} onSwipe={swiped} onOpen={() => undefined} tapToOpen={false} />
      </div>
      <ActionButtons hidden={index < 0} onNope={() => deckRef.current?.swipe('left')} onLike={() => deckRef.current?.swipe('right')} />
    </div>
  );
}
