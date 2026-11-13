'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { Podium, splitPodium } from '../../../components/leaderboard/Podium';
import { BoardRow } from '../../../components/leaderboard/BoardRow';
import { BoardEmpty, BoardLoading, BoardUnavailable } from '../../../components/leaderboard/BoardStatus';
import { useLeaderboard } from '../../../components/leaderboard/useLeaderboard';
import { useAuth } from '../../../components/auth/AuthProvider';
import { useSocial } from '../../../hooks/useSocial';
import { BoardEntry, POINTS, Period, formatRank, friendEntries, rankEntries } from '../../../lib/cloud/leaderboard';

type Tab = 'global' | 'amis';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Cette semaine' },
  { id: 'all', label: 'Tout le temps' },
];

const pill = (on: boolean) =>
  `flex-1 min-h-[44px] rounded-full border-[3px] border-plum font-black text-sm transition-all active:translate-y-0.5 ${
    on ? 'bg-plum text-cream shadow-none' : 'bg-white text-plum shadow-hard-sm'
  }`;

function EntryList({ entries, unit }: { entries: BoardEntry[]; unit?: string }) {
  const { rest } = splitPodium(entries);
  if (rest.length === 0) return null;
  return (
    <ol aria-label='Suite du classement' className='mt-5 space-y-2'>
      {rest.map(e => (
        <BoardRow key={e.key} entry={e} unit={unit} />
      ))}
    </ol>
  );
}

export default function ClassementPage() {
  const router = useRouter();
  const auth = useAuth();
  const { snapshot, friends } = useSocial();
  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<Period>('week');
  const [activating, setActivating] = useState(false);
  const { loading, board, mine, reload } = useLeaderboard(period, tab === 'global');

  const globalEntries = useMemo(() => rankEntries(board?.entries ?? []), [board]);
  const friendRows = useMemo(() => (snapshot ? friendEntries(snapshot, friends) : []), [snapshot, friends]);
  const myFriendRow = friendRows.find(e => e.isMe);

  const back = () => (window.history.length > 1 ? router.back() : router.push('/feed'));
  const activate = async () => {
    setActivating(true);
    const r = await auth.ensureSession();
    setActivating(false);
    if (r.ok) reload();
  };

  const unavailable = tab === 'global' && !loading && board?.status === 'unavailable';
  const showGlobal = tab === 'global' && !loading && board?.status === 'ok';

  // Ligne épinglée « Toi : #12 »
  let pinned: string | null = null;
  let pinnedSub = '';
  if (tab === 'amis' && myFriendRow) {
    pinned = `Toi : ${formatRank(myFriendRow.rank)}`;
    pinnedSub = `${myFriendRow.photos} photo${myFriendRow.photos > 1 ? 's' : ''} · ${friendRows.length} en lice`;
  } else if (showGlobal && mine?.status === 'ok') {
    pinned = mine.me.rank ? `Toi : ${formatRank(mine.me.rank)}` : 'Toi : pas encore classé';
    pinnedSub = mine.me.rank ? `${mine.me.score} pts · ${mine.me.photos} photo${mine.me.photos > 1 ? 's' : ''}, ${mine.me.hearts} cœur${mine.me.hearts > 1 ? 's' : ''}` : 'Poste une photo de plat pour entrer';
  }

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Classement'
        subtitle='Les plus belles photos de plats'
        right={
          <button onClick={back} aria-label='Retour' className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard active:translate-y-0.5 active:shadow-none transition-all shrink-0'>
            <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </button>
        }
      />

      <div className='shrink-0 px-4 pt-3 pb-3 space-y-3 border-b-[3px] border-plum bg-cream'>
        <div role='tablist' aria-label='Type de classement' className='flex gap-2'>
          {([['global', 'Global'], ['amis', 'Amis']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role='tab' aria-selected={tab === id} onClick={() => setTab(id)} className={pill(tab === id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'global' && (
          <div role='group' aria-label='Période' className='flex gap-2'>
            {PERIODS.map(p => (
              <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)} className={pill(period === p.id) + ' !text-xs'}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <p className='text-[11px] font-bold text-plum/70'>
          {tab === 'global'
            ? `${POINTS.photo} points par photo publiée, ${POINTS.heart} par cœur reçu. Les cœurs que tu te donnes ne comptent pas.`
            : 'Toi et tes amis, par nombre de photos puis XP. Rien n’est envoyé au serveur.'}
        </p>
      </div>

      <div role='tabpanel' className='flex-1 min-h-0 scroll-y px-4 pb-4'>
        {tab === 'global' && loading && <BoardLoading />}
        {unavailable && (
          <BoardUnavailable reason={board?.reason ?? 'error'} onRetry={reload} onActivate={auth.enabled ? activate : undefined} busy={activating} />
        )}
        {showGlobal && (globalEntries.length === 0 ? <BoardEmpty /> : (
          <>
            <Podium entries={globalEntries} />
            <EntryList entries={globalEntries} />
          </>
        ))}
        {tab === 'amis' && (
          friends.length === 0 ? (
            <div className='mt-4 bg-white/80 rounded-3xl border-[3px] border-dashed border-plum p-6 text-center space-y-3'>
              <p className='font-display text-xl text-plum'>Pas encore d’amis dans la course</p>
              <p className='text-sm font-medium text-slate-600'>Ajoute des amis pour comparer vos photos de plats.</p>
              <Link href='/amis' className='inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-bubblegum border-[3px] border-plum shadow-hard font-black text-sm text-plum'>Inviter des amis</Link>
            </div>
          ) : (
            <>
              <Podium entries={friendRows} unit='photos' />
              <EntryList entries={friendRows} unit='photos' />
            </>
          )
        )}
      </div>

      {pinned && (
        <div className='shrink-0 px-4 py-2.5 border-t-[3px] border-plum bg-bubblegum' aria-live='polite'>
          <p className='font-display text-xl text-plum leading-none'>{pinned}</p>
          <p className='text-[11px] font-bold text-plum/80 mt-1'>{pinnedSub}</p>
        </div>
      )}
    </div>
  );
}
