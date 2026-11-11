'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { PostCard } from '../../../components/feed/PostCard';
import { ComposeSheet, ComposeResult, LikedRestaurant } from '../../../components/feed/ComposeSheet';
import { useFeed } from '../../../hooks/useFeed';
import { useAvatar } from '../../../hooks/useAvatar';
import { useGamification } from '../../../hooks/useGamification';
import { stickerFor } from '../../../lib/stickers';
import { track } from '../../../lib/analytics';

function readLiked(): LikedRestaurant[] {
  try {
    const list = JSON.parse(localStorage.getItem('fooder_likes') || '[]') as LikedRestaurant[];
    return list.map(r => ({ id: r.id, name: r.name, cuisine: r.cuisine }));
  } catch {
    return [];
  }
}

export default function FeedPage() {
  const { posts, liked, addPost, removePost, toggleLike, commentsFor, addComment } = useFeed();
  const { avatar } = useAvatar();
  const { level } = useGamification();
  const [composeOpen, setComposeOpen] = useState(false);
  const [likedRestaurants, setLikedRestaurants] = useState<LikedRestaurant[]>([]);

  useEffect(() => {
    setLikedRestaurants(readLiked());
  }, [composeOpen]);

  const publish = ({ restaurant, caption, verdict, photo }: ComposeResult): boolean => {
    const ok = addPost({
      id: `mine-${Date.now()}`,
      author: { name: 'Toi', avatar, level },
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      cuisine: restaurant.cuisine,
      sticker: stickerFor(restaurant.cuisine, restaurant.id, restaurant.name),
      caption,
      verdict,
      photo,
      likes: 0,
      createdAt: Date.now(),
      mine: true,
    });
    if (ok) track('post_published', { has_photo: Boolean(photo) });
    return ok;
  };

  return (
    <div className='h-full flex flex-col bg-cream'>
      <PageHeader
        title='Le fil'
        subtitle='Les verdicts des foodies de Toulouse'
        right={
          <button
            onClick={() => setComposeOpen(true)}
            aria-label='Partager un resto'
            className='w-11 h-11 bg-bubblegum border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Plus className='w-5 h-5 text-plum' strokeWidth={3.5} />
          </button>
        }
      />
      <div className='flex-1 min-h-0 scroll-y px-4 py-4 space-y-4'>
        <AnimatePresence initial={false}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} liked={liked.includes(post.id)} comments={commentsFor(post.id)} onLike={toggleLike} onDelete={removePost} onComment={addComment} />
          ))}
        </AnimatePresence>
        <p className='text-center text-[11px] font-bold text-plum/50 pb-2'>Exemples de démo · le vrai fil arrive avec les comptes</p>
      </div>
      <ComposeSheet isOpen={composeOpen} liked={likedRestaurants} onClose={() => setComposeOpen(false)} onPublish={publish} />
    </div>
  );
}
