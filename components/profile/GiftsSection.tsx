import { Gift as GiftIcon, Lock } from 'lucide-react';
import { GIFTS, giftStatus, hasExampleGifts, nextGift } from '../../lib/gifts';

/** Mes cadeaux : bons par niveau. Honnête : étiquette « exemple » et aucun « Utiliser » tant qu'aucun partenaire n'est signé. */
export function GiftsSection({ level }: { level: number }) {
  const next = nextGift(level);
  return (
    <section aria-labelledby='cadeaux-titre' className='mx-4 mt-3 bg-white rounded-3xl border-[3px] border-plum shadow-hard p-4 space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <h2 id='cadeaux-titre' className='text-2xl leading-none text-plum flex items-center gap-2'>
          <GiftIcon className='w-5 h-5' strokeWidth={3} aria-hidden='true' /> Mes cadeaux
        </h2>
        {hasExampleGifts() && <span className='chip !text-[10px] !px-2 !py-0.5 bg-lemon text-plum shrink-0'>exemple</span>}
      </div>
      <p className='text-xs font-medium text-plum-muted leading-snug'>
        Aucun restaurant partenaire pour l’instant : voici comment les bons se débloqueront, par niveau.
      </p>
      <ul className='space-y-2'>
        {GIFTS.map(g => {
          const open = giftStatus(g, level) === 'unlocked';
          return (
            <li key={g.id} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 min-h-[44px] ${open ? 'border-plum bg-fooder-mint/40' : 'border-plum/20 bg-cream/60'}`}>
              <span className='flex-1 min-w-0 text-sm font-bold text-plum truncate'>{g.title}</span>
              <span className='text-xs font-bold text-plum-muted shrink-0 flex items-center gap-1'>
                {open ? 'débloqué' : <><Lock className='w-3 h-3' strokeWidth={3} aria-hidden='true' /> niv. {g.level}</>}
              </span>
            </li>
          );
        })}
      </ul>
      {next && <p className='text-xs font-bold text-plum'>Prochain bon au niveau {next.level}.</p>}
    </section>
  );
}
