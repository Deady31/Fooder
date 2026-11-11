'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Target, UserMinus } from 'lucide-react';
import { Avatar } from '../profile/Avatar';
import { MatchBadge } from './MatchBadge';
import { Friend } from '../../lib/social/friends';
import { FriendSnapshot } from '../../lib/social/snapshot';
import { foodMatch } from '../../lib/social/match';
import { timeAgo } from '../../lib/feed';

interface FriendRowProps {
  friend: Friend;
  me: FriendSnapshot;
  onDefi: (friend: Friend) => void;
  onRemove: (id: string) => void;
}

export function FriendRow({ friend, me, onDefi, onRemove }: FriendRowProps) {
  const [open, setOpen] = useState(false);
  const s = friend.snapshot;
  const match = foodMatch(me, s);

  return (
    <li className='bg-white rounded-3xl border-[3px] border-plum shadow-hard overflow-hidden'>
      <button onClick={() => setOpen(o => !o)} className='w-full flex items-center gap-3 p-3 text-left' aria-expanded={open}>
        <Avatar avatar={s.avatar} size={48} />
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-plum truncate'>{s.name}</p>
          <p className='text-[11px] font-bold text-plum/50 truncate'>niv. {s.level} · {s.archetype}</p>
        </div>
        <MatchBadge match={match} />
        <ChevronDown className={`w-4 h-4 text-plum transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={3} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className='overflow-hidden'>
            <div className='px-4 pb-4 pt-1 space-y-3 border-t-2 border-dashed border-plum/20'>
              <p className='font-display text-lg text-plum pt-2'>{match.verdict}</p>
              {match.common.length > 0 ? (
                <div>
                  <p className='text-[11px] font-black text-plum/60 mb-1'>Vous avez liké tous les deux</p>
                  <ul className='flex flex-wrap gap-1.5'>
                    {match.common.slice(0, 6).map(c => (
                      <li key={c.id} className='chip !text-[11px] bg-cream text-plum'>{c.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className='text-xs font-medium text-slate-600'>Aucun resto en commun pour l’instant : lancez une session de groupe !</p>
              )}
              {match.toDiscover && (
                <p className='text-xs font-medium text-slate-600'>
                  Son péché mignon que tu n’as jamais liké : <b className='text-plum'>{match.toDiscover}</b>.
                </p>
              )}
              <div className='grid grid-cols-3 gap-2 text-center'>
                {[
                  [s.visits, 'visites'],
                  [s.streak, 'sem. série'],
                  [s.quartiers.length, 'quartiers'],
                ].map(([v, l]) => (
                  <div key={l} className='rounded-xl bg-cream border-2 border-plum py-1.5'>
                    <p className='font-display text-xl text-plum leading-none'>{v}</p>
                    <p className='text-[10px] font-bold text-plum/60'>{l}</p>
                  </div>
                ))}
              </div>
              <p className='text-[10px] font-bold text-plum/40'>Carte mise à jour {timeAgo(s.at)} · elle se rafraîchit quand {s.name} te renvoie son lien</p>
              <div className='flex gap-2'>
                <button onClick={() => onDefi(friend)} className='flex-1 duo-button bg-fooder-secondary text-plum py-2.5 text-sm flex items-center justify-center gap-1.5'>
                  <Target className='w-4 h-4' strokeWidth={2.5} /> Lancer un défi
                </button>
                <button
                  onClick={() => onRemove(s.id)}
                  aria-label={`Retirer ${s.name}`}
                  className='w-12 shrink-0 duo-button bg-white text-plum/60 py-2.5 flex items-center justify-center'
                >
                  <UserMinus className='w-4 h-4' strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
