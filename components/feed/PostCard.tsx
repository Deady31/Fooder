'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { FeedPost, MAX_COMMENT, VERDICTS, timeAgo } from '../../lib/feed';
import { CommentItem } from './CommentItem';
import type { EditResult, StoredComment } from './commentEdit';
import { Avatar } from '../profile/Avatar';
import { isDemoPost, isVisitPost } from './feedLogic';
import { Sticker } from '../ui/Sticker';
import { Lightbox } from '../ui/Lightbox';

interface PostCardProps {
  post: FeedPost;
  liked: boolean;
  /** Nombre de « miam » à afficher (voir miamCount) : jamais recalculé ici. */
  count: number;
  comments: StoredComment[];
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onComment: (postId: string, text: string) => boolean;
  onEditComment: (commentId: string, text: string) => EditResult;
}

/** Texte du tampon : teintes accessibles (les couleurs vives restent pour le contour). */
const VERDICT_INK: Record<string, string> = { miam: '#0B7A47', bof: '#C4105E', atester: '#6C2BFF' };

/** Un post = un ticket de caisse : tampon de verdict, nom du resto, mot, perforation, réactions. */
export function PostCard({ post, liked, count, comments, onLike, onDelete, onComment, onEditComment }: PostCardProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [draft, setDraft] = useState('');
  const verdict = VERDICTS.find(v => v.id === post.verdict) ?? VERDICTS[0];
  const isDemo = isDemoPost(post);
  const isVisit = isVisitPost(post);

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
            style={{ color: VERDICT_INK[verdict.id] ?? '#2B0F3A', borderColor: verdict.color }}
          >
            {verdict.label}
          </span>
          <div className='flex items-center gap-1.5 shrink-0'>
            {isDemo && <span className='chip !text-[10px] !px-2 !py-0.5 bg-lemon text-plum'>exemple</span>}
            {isVisit && <span className='chip !text-[10px] !px-2 !py-0.5 bg-fooder-mint text-plum'>visite confirmée</span>}
            <span className='chip !text-[10px] !px-2 !py-0.5 bg-cream text-plum'>{post.cuisine}</span>
          </div>
        </div>

        <h3 className='mt-3 text-[clamp(20px,6.2vw,24px)] leading-[1.05] text-plum break-words'>{post.restaurantName}</h3>

        <div className='mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-plum-muted min-w-0'>
          <Avatar avatar={post.author.avatar} size={28} className='!border-2 !shadow-none' />
          <span className='truncate'>
            <span className='font-bold text-plum'>{post.mine ? 'Toi' : post.author.name}</span> · niv. {post.author.level} · {isDemo ? 'exemple' : timeAgo(post.createdAt)}
          </span>
        </div>

        {post.photo && (
          <button
            type='button'
            onClick={() => setZoom(true)}
            aria-label={`Agrandir la photo de ${post.restaurantName}`}
            className='mt-3 block w-full overflow-hidden rounded-xl border-[3px] border-plum shadow-hard-sm active:translate-y-0.5 transition-transform'
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.photo} alt={`Photo de ${post.restaurantName}`} className='block w-full aspect-[4/3] object-cover' draggable={false} />
          </button>
        )}

        <div className='mt-3'>
          {post.caption ? (
            <p className='text-sm font-medium text-plum leading-snug break-words rounded-xl border-2 border-dashed border-plum/30 bg-cream/60 px-3 py-2'>
              {post.caption}
            </p>
          ) : !post.photo ? (
            <div className='flex items-center'>
              <Sticker name={post.sticker} size={56} rotate={-6} />
            </div>
          ) : null}
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
        {post.mine && !isVisit && (
          <button onClick={() => onDelete(post.id)} aria-label='Supprimer mon post' className='ml-auto w-11 h-11 flex items-center justify-center text-plum-muted active:text-plum'>
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
              {comments.length === 0 && <li className='text-xs font-semibold text-plum-muted'>Personne n&apos;a encore commenté. Lance la discussion.</li>}
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} onEdit={onEditComment} />
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
      {zoom && post.photo && (
        <Lightbox images={[post.photo]} index={0} alt={`Photo de ${post.restaurantName}`} onIndexChange={() => undefined} onClose={() => setZoom(false)} />
      )}
    </motion.article>
  );
}
