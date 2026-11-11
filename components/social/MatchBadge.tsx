import { FoodMatch } from '../../lib/social/match';

/** Pastille de compatibilité : couleur selon le score. */
export function MatchBadge({ match, size = 'sm' }: { match: FoodMatch; size?: 'sm' | 'lg' }) {
  const s = match.score;
  const bg = s === null ? 'bg-white' : s >= 70 ? 'bg-bubblegum' : s >= 40 ? 'bg-fooder-secondary' : 'bg-fooder-mint';
  if (size === 'lg') {
    return (
      <div className={`inline-flex flex-col items-center px-5 py-3 rounded-[24px] border-[3px] border-plum shadow-hard ${bg}`}>
        <span className='font-display text-5xl leading-none text-plum'>{s === null ? '?' : `${s} %`}</span>
        <span className='text-xs font-black text-plum mt-1'>Food Match</span>
      </div>
    );
  }
  return (
    <span className={`chip !px-2.5 !py-1 text-plum text-xs ${bg}`}>
      {s === null ? '? %' : `${s} %`}
    </span>
  );
}
