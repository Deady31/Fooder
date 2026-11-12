'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, Users } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { MyCard } from '../../../components/social/MyCard';
import { InviteCard } from '../../../components/social/InviteCard';
import { FriendRow } from '../../../components/social/FriendRow';
import { WeeklyBoard } from '../../../components/social/WeeklyBoard';
import { DefiComposer } from '../../../components/social/DefiComposer';
import { Sticker } from '../../../components/ui/Sticker';
import { useToast } from '../../../components/ui/Toast';
import { useSocial } from '../../../hooks/useSocial';
import { Friend, removeFriend } from '../../../lib/social/friends';
import { bestTitle, contributorTitles } from '../../../lib/rituals';
import { removeFriendCloud } from '../../../lib/cloud/social';

export default function FriendsPage() {
  const { snapshot, friends, visits, defis } = useSocial();
  const [defiFor, setDefiFor] = useState<Friend | null | undefined>(undefined);
  const toast = useToast();

  if (!snapshot) return null;
  const title = bestTitle(contributorTitles(visits, snapshot.photos));
  const pendingDefis = defis.filter(d => !d.done).length;

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Amis'
        subtitle={friends.length > 0 ? `${friends.length} ami${friends.length > 1 ? 's' : ''} · compare vos goûts` : 'Mange mieux, à plusieurs'}
        right={
          <Link href='/profile' aria-label='Retour au profil' className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard shrink-0'>
            <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
        }
      />

      <div className='flex-1 min-h-0 scroll-y px-4 py-4 space-y-4'>
        <InviteCard />

        <MyCard snapshot={snapshot} title={title} onToast={toast.show} />

        <div className='grid grid-cols-2 gap-3'>
          <Link href='/groupe' className='bg-fooder-secondary rounded-3xl border-[3px] border-plum shadow-hard p-3 flex flex-col gap-1 active:translate-y-0.5'>
            <Users className='w-5 h-5 text-plum' strokeWidth={2.5} />
            <span className='font-display text-lg text-plum leading-tight'>On mange où ?</span>
            <span className='text-[11px] font-bold text-plum/70'>Swipez ensemble, décidez vite</span>
          </Link>
          <Link href='/defi' className='bg-bubblegum rounded-3xl border-[3px] border-plum shadow-hard p-3 flex flex-col gap-1 active:translate-y-0.5 relative'>
            <Target className='w-5 h-5 text-plum' strokeWidth={2.5} />
            <span className='font-display text-lg text-plum leading-tight'>Défis à l’aveugle</span>
            <span className='text-[11px] font-bold text-plum/70'>{pendingDefis > 0 ? `${pendingDefis} en attente` : 'Reçus et envoyés'}</span>
            {pendingDefis > 0 && <span className='absolute top-2 right-2 w-3 h-3 rounded-full bg-white border-2 border-plum' />}
          </Link>
        </div>

        <WeeklyBoard me={snapshot} friends={friends} />

        <section className='space-y-3'>
          <div className='flex items-end justify-between'>
            <h2 className='text-2xl text-plum leading-none'>Mes amis</h2>
            <button onClick={() => setDefiFor(null)} className='text-xs font-black text-plum underline underline-offset-2'>
              Défier quelqu’un
            </button>
          </div>
          {friends.length === 0 ? (
            <div className='bg-white/80 rounded-3xl border-[3px] border-dashed border-plum p-5 flex flex-col items-center text-center gap-2'>
              <Sticker name='b_heart' size={72} rotate={-8} className='bob' />
              <p className='font-display text-xl text-plum'>Ajoute ton premier ami</p>
              <p className='text-sm font-medium text-slate-600'>Fais-lui scanner ton QR code, ou envoie ton lien. Quand il t’envoie le sien, il apparaît ici avec votre Food Match.</p>
            </div>
          ) : (
            <ul className='space-y-3'>
              {friends.map(f => (
                <FriendRow
                  key={f.snapshot.id}
                  friend={f}
                  me={snapshot}
                  onDefi={setDefiFor}
                  onRemove={id => {
                    removeFriend(id);
                    void removeFriendCloud(id);
                    toast.show('Ami retiré');
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <p className='text-center text-[11px] font-bold text-plum/50 pb-2'>
          Prototype sans compte : les cartes d’amis se mettent à jour quand ils te renvoient leur lien.
        </p>
      </div>

      <DefiComposer isOpen={defiFor !== undefined} friendName={defiFor?.snapshot.name} onClose={() => setDefiFor(undefined)} onToast={toast.show} />
      {toast.node}
    </div>
  );
}
