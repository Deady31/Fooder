'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { FeedComment, FeedPost, MAX_COMMENT, VERDICTS, timeAgo } from '../../lib/feed';
import { Avatar } from '../profile/Avatar';
import { Sticker } from '../ui/Sticker';

interface PostCardProps {
  post: FeedPost;
  liked: boolean;
  comments: FeedComment[];
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, text: string) => boolean;
}

/** Un post = un ticket de caisse : tampon de verdict, nom du resto, mot, perforation, réactions. */
export function PostCard({ post, liked, comments, onLike, onDelete, onComment }: PostCardProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const verdict = VERDICTS.find(v => v.id === post.verdict) ?? VERDICTS[0];
  const isSeed = post.id.startsWith('seed-');
  const count = post.likes + (liked ? 1 : 0);

  const send = () => {
    if (onComment(post.id, draft)) setDraft('');
  };

  return (
    <motion.article
      layout='position'
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className='relative bg-white rounded-2xl border-[3px] border-plum shadow-hard'
    >
      <div className='p-4 pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <span
            className='inline-block font-display text-xl leading-none px-2.5 py-1.5 rounded-lg border-[3px] -rotate-6 bg-cream'
            style={{ color: verdict.color, borderColor: verdict.color }}
          >
            {verdict.label}
          </span>
          <div className='flex items-center gap-1.5 shrink-0'>
            {isSeed && <span className='chip !text-[9px] !px-2 !py-0.5 bg-lemon text-plum'>démo</span>}
            <span className='chip !text-[10px] !px-2 !py-0.5 bg-cream text-plum'>{post.cuisine}</span>
          </div>
        </div>

        <h3 className='mt-3 text-[clamp(20px,6.2vw,24px)] leading-[1.05] text-plum break-words'>{post.restaurantName}</h3>

        <div className='mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-plum/60 min-w-0'>
          <Avatar avatar={post.author.avatar} size={22} className='!border-2 !shadow-none' />
          <span className='truncate'>
            {post.mine ? 'Toi' : post.author.name} · niv. {post.author.level} · {timeAgo(post.createdAt)}
          </span>
        </div>

        <div className='mt-3 flex items-start gap-3'>
          <div className='flex-1 min-w-0'>
            {post.caption ? (
              <p className='text-sm font-medium text-plum leading-snug break-words rounded-xl border-2 border-dashed border-plum/30 bg-cream/60 px-3 py-2'>
                {post.caption}
              </p>
            ) : (
              <div className='flex items-center'>
                <Sticker name={post.sticker} size={56} rotate={-6} />
              </div>
            )}
          </div>
          {post.photo && (
            <div className='relative shrink-0 rotate-3 bg-white p-1 pb-3 border-[3px] border-plum shadow-hard-sm'>
              <span aria-hidden className='absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-lemon/90 border-2 border-plum/40 -rotate-3' />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.photo} alt={`Photo de ${post.restaurantName}`} className='w-20 h-20 object-cover' draggable={false} />
            </div>
          )}
        </div>
      </div>

      <div className='relative border-t-[3px] border-dashed border-plum/40'>
        <span aria-hidden className='absolute -left-[14px] -top-[11px] w-5 h-5 rounded-full bg-cream border-[3px] border-plum' />
        <span aria-hidden className='absolute -right-[14px] -top-[11px] w-5 h-5 rounded-full bg-cream border-[3px] border-plum' />
      </div>

      <div className='flex items-center gap-1 px-2 py-1'>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => onLike(post.id)}
          aria-pressed={liked}
          aria-label={liked ? 'Retirer mon miam' : 'Miam'}
          className='flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-bold text-plum'
        >
          <motion.span key={String(liked)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
            <Heart className={`w-5 h-5 ${liked ? 'fill-bubblegum' : ''}`} strokeWidth={2.5} />
          </motion.span>
          {count}
        </motion.button>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={`${comments.length} commentaire${comments.length > 1 ? 's' : ''}`}
          className={`flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-bold text-plum rounded-full transition-colors ${open ? 'bg-lemon/70' : ''}`}
        >
          <MessageCircle className='w-5 h-5' strokeWidth={2.5} />
          {comments.length}
        </button>
        {post.mine && (
          <button onClick={() => onDelete(post.id)} aria-label='Supprimer mon post' className='ml-auto w-11 h-11 flex items-center justify-center text-plum/50 active:text-plum'>
            <Trash2 className='w-5 h-5' strokeWidth={2.5} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className='overflow-hidden rounded-b-[13px] bg-cream/70 border-t-2 border-plum/20'
          >
            <ul className='px-4 pt-3 space-y-2'>
              {comments.length === 0 && <li className='text-xs font-semibold text-plum/50'>Personne n&apos;a encore commenté. Lance la discussion.</li>}
              {comments.map(c => (
                <li key={c.id} className='text-sm leading-snug break-words'>
                  <span className='font-bold text-plum'>{c.mine ? 'Toi' : c.authorName}</span>{' '}
                  <span className='font-medium text-slate-700'>{c.text}</span>
                  <span className='text-[10px] font-bold text-plum/40'> · {timeAgo(c.createdAt)}</span>
                </li>
              ))}
            </ul>
            <form
              onSubmit={e => {
                e.preventDefault();
                send();
              }}
              className='flex items-center gap-2 p-3'
            >
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={MAX_COMMENT}
                placeholder='Ajoute un mot…'
                aria-label='Ton commentaire'
                className='flex-1 min-w-0 rounded-full border-[3px] border-plum bg-white px-4 py-2 text-base font-medium text-plum outline-none focus:shadow-hard-sm'
              />
              <button
                type='submit'
                disabled={!draft.trim()}
                aria-label='Envoyer'
                className='w-11 h-11 shrink-0 rounded-full bg-bubblegum border-[3px] border-plum flex items-center justify-center shadow-hard-sm active:translate-y-0.5 disabled:opacity-40 transition-all'
              >
                <Send className='w-4 h-4 text-plum' strokeWidth={3} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
