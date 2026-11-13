import { Avatar } from '../profile/Avatar';
import { BoardEntry, formatRank, medalFor, statsLine } from '../../lib/cloud/leaderboard';

/** Une ligne du classement (liste ordonnée). Ta ligne est surlignée. */
export function BoardRow({ entry, unit = 'pts' }: { entry: BoardEntry; unit?: string }) {
  const medal = medalFor(entry.rank);
  return (
    <li
      aria-current={entry.isMe ? 'true' : undefined}
      className={`flex items-center gap-3 min-h-[56px] rounded-2xl px-3 py-2 border-[3px] ${
        entry.isMe ? 'border-plum bg-bubblegum/30 shadow-hard' : 'border-plum/15 bg-white'
      }`}
    >
      <span className='w-10 shrink-0 text-center font-display text-lg text-plum'>
        {medal ? <span aria-hidden>{medal}</span> : null}
        <span className={medal ? 'sr-only' : ''}>{formatRank(entry.rank)}</span>
      </span>
      <Avatar avatar={entry.avatar} size={40} />
      <span className='flex-1 min-w-0'>
        <span className='block font-bold text-sm text-plum truncate'>{entry.isMe ? `${entry.name} (toi)` : entry.name}</span>
        <span className='block text-[11px] font-bold text-plum/60 truncate'>{statsLine(entry)}</span>
      </span>
      <span className='text-right shrink-0'>
        <span className='block font-display text-2xl text-plum leading-none'>{entry.score}</span>
        <span className='block text-[10px] font-black text-plum/60'>{unit}</span>
      </span>
    </li>
  );
}
