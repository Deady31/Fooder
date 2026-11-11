import { Avatar } from '../profile/Avatar';
import { Friend, weeklyRanking } from '../../lib/social/friends';
import { FriendSnapshot } from '../../lib/social/snapshot';

const MEDALS = ['bg-fooder-secondary', 'bg-white', 'bg-fooder-orange'];

/** Classement de la semaine, entre amis seulement : nouveaux restos testés. */
export function WeeklyBoard({ me, friends }: { me: FriendSnapshot; friends: Friend[] }) {
  const rows = weeklyRanking(me, friends);
  return (
    <section className='bg-white rounded-[28px] panel p-4 space-y-3'>
      <div className='flex items-end justify-between gap-2'>
        <h2 className='text-2xl text-plum leading-none'>Classement de la semaine</h2>
        <span className='text-[10px] font-black text-plum/50 shrink-0'>restos testés</span>
      </div>
      <ol className='space-y-2'>
        {rows.map((r, i) => (
          <li key={r.snapshot.id} className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 border-[3px] ${r.isMe ? 'border-plum bg-bubblegum/30' : 'border-transparent'}`}>
            <span className={`w-8 h-8 shrink-0 rounded-full border-[3px] border-plum flex items-center justify-center font-display text-sm text-plum ${MEDALS[i] ?? 'bg-cream'}`}>
              {i + 1}
            </span>
            <Avatar avatar={r.snapshot.avatar} size={36} />
            <span className='flex-1 min-w-0'>
              <span className='block font-bold text-sm text-plum truncate'>{r.isMe ? 'Toi' : r.snapshot.name}</span>
              {r.stale && !r.isMe && <span className='block text-[10px] font-bold text-plum/40'>carte d’une autre semaine</span>}
            </span>
            <span className='font-display text-2xl text-plum'>{r.score}</span>
          </li>
        ))}
      </ol>
      {friends.length === 0 && <p className='text-xs font-medium text-slate-600'>Ajoute des amis pour voir qui découvre le plus de restos chaque semaine.</p>}
    </section>
  );
}
