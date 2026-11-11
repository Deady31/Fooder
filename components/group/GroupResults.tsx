'use client';
import { motion } from 'framer-motion';
import { MapPin, RotateCcw, Share2 } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { stickerFor } from '../../lib/stickers';
import { GroupSession, groupResults } from '../../lib/social/group';

interface GroupResultsProps {
  session: GroupSession;
  myId: string;
  onShare: () => void;
  onRevote: () => void;
}

const mapsUrl = (name: string, quartier?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${quartier ?? ''} Toulouse`)}`;

export function GroupResults({ session, myId, onShare, onRevote }: GroupResultsProps) {
  const results = groupResults(session);
  const voters = session.votes.length;
  const winner = results[0];
  const hasWinner = winner && winner.likes > 0;
  const voted = session.votes.some(v => v.voterId === myId);

  return (
    <div className='space-y-4'>
      <section className='bg-white rounded-[28px] panel p-4 space-y-2'>
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-2xl text-plum leading-none'>{session.title}</h2>
          <span className='chip bg-fooder-secondary text-plum text-xs shrink-0'>{voters} vote{voters > 1 ? 's' : ''}</span>
        </div>
        <p className='text-xs font-bold text-plum/60'>{session.votes.map(v => (v.voterId === myId ? 'Toi' : v.name)).join(', ') || 'Personne n’a encore voté'}</p>
        {voters < 2 && <p className='text-xs font-medium text-slate-600'>Envoie la session au groupe : chaque vote reçu complète les résultats.</p>}
      </section>

      {hasWinner && voters >= 2 && (
        <motion.section
          initial={{ scale: 0.9, rotate: -2, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          className='bg-bubblegum rounded-[28px] panel p-5 text-center space-y-2 relative overflow-hidden'
        >
          <div className='absolute -right-3 -top-3 bob' style={{ ['--r' as string]: '12deg' }}>
            <Sticker name={stickerFor(winner.resto.cuisine, winner.resto.id, winner.resto.name)} size={92} rotate={12} />
          </div>
          <p className='text-xs font-black text-plum/70'>{winner.perfect ? 'MATCH PARFAIT' : 'Le favori du groupe'}</p>
          <h3 className='text-[30px] leading-none text-plum pr-14'>{winner.resto.name}</h3>
          <p className='text-sm font-bold text-plum/80'>{winner.likes}/{voters} · {winner.voters.join(', ')}</p>
          <a
            href={mapsUrl(winner.resto.name, winner.resto.quartier)}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 duo-button bg-white text-plum px-6 py-3 text-sm mt-1'
          >
            <MapPin className='w-4 h-4' /> On y va
          </a>
        </motion.section>
      )}

      <ol className='space-y-2'>
        {results.map((r, i) => (
          <li key={r.resto.id} className='flex items-center gap-3 bg-white rounded-2xl border-[3px] border-plum p-2.5'>
            <span className='w-7 text-center font-display text-lg text-plum'>{i + 1}</span>
            <Sticker name={stickerFor(r.resto.cuisine, r.resto.id, r.resto.name)} size={36} />
            <span className='flex-1 min-w-0'>
              <span className='block font-bold text-sm text-plum truncate'>{r.resto.name}</span>
              <span className='block text-[11px] font-bold text-plum/50 truncate'>{r.voters.length > 0 ? r.voters.join(', ') : 'personne'}</span>
            </span>
            <span className='chip !px-2 text-xs bg-cream text-plum'>{r.likes}/{voters}</span>
          </li>
        ))}
      </ol>

      <div className='grid grid-cols-[1fr_2fr] gap-2.5'>
        <button onClick={onRevote} className='duo-button bg-white text-plum py-3.5 text-sm flex items-center justify-center gap-1.5'>
          <RotateCcw className='w-4 h-4' /> {voted ? 'Revoter' : 'Voter'}
        </button>
        <button onClick={onShare} className='duo-button bg-fooder-secondary text-plum py-3.5 text-sm flex items-center justify-center gap-2'>
          <Share2 className='w-4 h-4' strokeWidth={2.5} /> Envoyer au groupe
        </button>
      </div>
    </div>
  );
}
