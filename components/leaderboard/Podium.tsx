import { Avatar } from '../profile/Avatar';
import { BoardEntry, medalFor } from '../../lib/cloud/leaderboard';

const SPOT = [
  // 1er au centre, plus haut ; 2e à gauche, 3e à droite
  { bar: 'h-24 bg-fooder-secondary', avatar: 76, order: 'order-2' },
  { bar: 'h-16 bg-bubblegum', avatar: 60, order: 'order-1' },
  { bar: 'h-12 bg-fooder-mint', avatar: 60, order: 'order-3' },
];

/** Sépare le podium (3 premiers rangés dans le top 3) du reste de la liste : personne ne disparaît en cas d'ex æquo. */
export function splitPodium(entries: BoardEntry[]): { top: BoardEntry[]; rest: BoardEntry[] } {
  const top = entries.filter(e => e.rank <= 3).slice(0, 3);
  const keys = new Set(top.map(e => e.key));
  return { top, rest: entries.filter(e => !keys.has(e.key)) };
}

/** Podium du top 3 (les ex æquo partagent la même marche). Les rangs suivants sont dans la liste. */
export function Podium({ entries, unit = 'points' }: { entries: BoardEntry[]; unit?: string }) {
  const { top } = splitPodium(entries);
  if (top.length === 0) return null;
  return (
    <ol aria-label='Podium' className='flex items-end justify-center gap-2 px-1 pt-3'>
      {top.map(e => {
        const spot = SPOT[Math.min(e.rank, 3) - 1];
        return (
          <li key={e.key} className={`flex-1 min-w-0 max-w-[132px] flex flex-col items-center ${spot.order}`}>
            <span className='text-3xl leading-none' aria-hidden>{medalFor(e.rank)}</span>
            <div className={e.isMe ? 'mt-1 rounded-[26px] ring-4 ring-plum ring-offset-2 ring-offset-cream' : 'mt-1'}>
              <Avatar avatar={e.avatar} size={spot.avatar} />
            </div>
            <p className='mt-2 w-full text-center font-bold text-sm text-plum truncate'>{e.isMe ? 'Toi' : e.name}</p>
            <div className={`mt-1 w-full ${spot.bar} border-[3px] border-plum rounded-t-2xl shadow-hard flex flex-col items-center justify-center`}>
              <span className='sr-only'>{e.rank === 1 ? '1er' : `${e.rank}e`}, </span>
              <span className='font-display text-2xl text-plum leading-none'>{e.score}</span>
              <span className='text-[10px] font-black text-plum/70'>{unit}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
