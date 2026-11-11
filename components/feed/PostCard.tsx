'use client';
import { motion } from 'framer-motion';
import { Heart, Trash2 } from 'lucide-react';
import { FeedPost, timeAgo } from '../../lib/feed';
import { Avatar } from '../profile/Avatar';
import { Sticker } from '../ui/Sticker';

interface PostCardProps {
  post: FeedPost;
  liked: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PostCard({ post, liked, onLike, onDelete }: PostCardProps) {
  const count = post.likes + (liked ? 1 : 0);
  const isSeed = post.id.startsWith('seed-');

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className='bg-white rounded-3xl border-[3px] border-plum shadow-hard overflow-hidden'
    >
      <header className='flex items-center gap-3 p-3'>
        <Avatar avatar={post.author.avatar} size={42} />
        <div className='min-w-0 flex-1'>
          <p className='font-bold text-sm text-plum leading-tight truncate'>
            {post.mine ? 'Toi' : post.author.name}
            <span className='text-plum/50 font-semibold'> · niv. {post.author.level}</span>
          </p>
          <p className='text-[11px] font-semibold text-plum/60 truncate'>
            a aimé <span className='text-plum font-bold'>{post.restaurantName}</span> · {timeAgo(post.createdAt)}
          </p>
        </div>
        {isSeed && <span className='chip !text-[9px] !px-2 !py-0.5 bg-lemon text-plum'>démo</span>}
      </header>

      <div className='relative border-y-[3px] border-plum bg-fooder-secondary'>
        {post.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photo} alt={`Photo de ${post.restaurantName}`} className='w-full aspect-[4/3] object-cover' draggable={false} />
        ) : (
          <div className='w-full aspect-[16/9] flex items-center justify-center'>
            <Sticker name={post.sticker} size={96} rotate={-6} />
          </div>
        )}
        <span className='chip absolute left-3 bottom-3 bg-white text-plum text-[11px]'>{post.cuisine}</span>
      </div>

      <div className='p-3 space-y-2'>
        {post.caption && <p className='text-sm font-medium text-plum leading-snug break-words'>{post.caption}</p>}
        <div className='flex items-center justify-between'>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onLike(post.id)}
            aria-pressed={liked}
            aria-label={liked ? 'Retirer le j’aime' : 'Aimer ce post'}
            className='flex items-center gap-1.5 min-h-[44px] pr-3 text-sm font-bold text-plum'
          >
            <motion.span key={String(liked)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
              <Heart className={`w-6 h-6 ${liked ? 'fill-bubblegum text-plum' : 'text-plum'}`} strokeWidth={2.5} />
            </motion.span>
            {count}
          </motion.button>
          {post.mine && (
            <button onClick={() => onDelete(post.id)} aria-label='Supprimer mon post' className='w-11 h-11 flex items-center justify-center text-plum/60 active:text-plum'>
              <Trash2 className='w-5 h-5' strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
