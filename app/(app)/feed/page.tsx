'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Plus, Trophy, Users } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { PostCard } from '../../../components/feed/PostCard';
import { ComposeSheet, ComposeResult, LikedRestaurant } from '../../../components/feed/ComposeSheet';
import { useFeed } from '../../../hooks/useFeed';
import { useAvatar } from '../../../hooks/useAvatar';
import { useGamification } from '../../../hooks/useGamification';
import { stickerFor } from '../../../lib/stickers';
import { track } from '../../../lib/analytics';
import { newPostId } from '../../../lib/share';
import type { OsmRecord } from '../../../lib/osm';
import { isSharable, resolvePhotoPreset } from '../../../lib/restoShare';
import { verdictSlug } from '../../../lib/usageProps';
import { useToast } from '../../../components/ui/Toast';

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
  const [preset, setPreset] = useState<LikedRestaurant | null>(null);
  const toast = useToast(4000);

  // Arrivée depuis une fiche (« Propose la vraie photo ») : on ouvre le formulaire sur ce resto.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('photo');
    if (!id) return;
    window.history.replaceState(null, '', '/feed');
    // L'URL n'est pas fiable : seul l'id compte, nom et cuisine viennent du jeu de données (chargé à la demande).
    if (!isSharable(id)) return;
    import('../../../data/toulouse-places.json')
      .then(mod => {
        const found = resolvePhotoPreset(mod.default as OsmRecord[], id);
        if (!found) return;
        setPreset(found);
        setComposeOpen(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLikedRestaurants(readLiked());
  }, [composeOpen]);

  const publish = ({ restaurant, caption, verdict, photo }: ComposeResult): boolean => {
    const ok = addPost({
      id: newPostId(),
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
    }, toast.show);
    if (ok) {
      track('post_published', { has_photo: Boolean(photo) });
      if (photo) track('photo_posted', { verdict: verdictSlug(verdict) });
    }
    return ok;
  };

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Le fil'
        subtitle='Les verdicts des foodies de Toulouse'
        right={
          <div className='flex gap-2 shrink-0'>
          <Link
            href='/classement'
            aria-label='Classement'
            className='w-11 h-11 bg-fooder-secondary border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Trophy className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
          <Link
            href='/amis'
            aria-label='Mes amis'
            className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Users className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
          <button
            onClick={() => setComposeOpen(true)}
            aria-label='Partager un resto'
            className='w-11 h-11 bg-bubblegum border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'
          >
            <Plus className='w-5 h-5 text-plum' strokeWidth={3.5} />
          </button>
          </div>
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
      {toast.node}
      <ComposeSheet isOpen={composeOpen} liked={likedRestaurants}
        preset={preset} onClose={() => { setComposeOpen(false); setPreset(null); }} onPublish={publish} />
    </div>
  );
}
