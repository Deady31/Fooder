'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Share2, UserPlus } from 'lucide-react';
import { Avatar } from '../../../../components/profile/Avatar';
import { MatchBadge } from '../../../../components/social/MatchBadge';
import { Sticker } from '../../../../components/ui/Sticker';
import { useToast } from '../../../../components/ui/Toast';
import { decodePayload, readHashParam } from '../../../../lib/social/codec';
import { FriendSnapshot, parseSnapshot } from '../../../../lib/social/snapshot';
import { buildMySnapshot, friendLink, readFriends, upsertFriend } from '../../../../lib/social/friends';
import { foodMatch } from '../../../../lib/social/match';
import { outcomeLabel, shareLink } from '../../../../lib/share';
import { XP, awardXp, unlockAchievement } from '../../../../lib/rewards';
import { track } from '../../../../lib/analytics';
import { useAuth } from '../../../../components/auth/AuthProvider';
import { addFriendByCode } from '../../../../lib/cloud/social';
import { runWithSession } from '../../../../lib/cloud/gate';

type Status = 'loading' | 'invalid' | 'preview' | 'update' | 'added' | 'updated' | 'self';

export default function AddFriendPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [friend, setFriend] = useState<FriendSnapshot | null>(null);
  const [me, setMe] = useState<FriendSnapshot | null>(null);
  const toast = useToast();
  const auth = useAuth();
  const [mutual, setMutual] = useState(false);

  useEffect(() => {
    const ingest = async () => {
      setStatus('loading');
      const raw = readHashParam('p');
      const snap = raw ? parseSnapshot(await decodePayload(raw)) : null;
      const mine = buildMySnapshot();
      setMe(mine);
      if (!snap) return setStatus('invalid');
      setFriend(snap);
      if (snap.id === mine.id) return setStatus('self');
      const known = readFriends().some(f => f.snapshot.id === snap.id);
      if (known) {
        setStatus('update');
      } else {
        setStatus('preview');
      }
    };
    ingest();
    window.addEventListener('hashchange', ingest);
    return () => window.removeEventListener('hashchange', ingest);
  }, []);

  const add = async () => {
    if (!friend) return;
    // addFriendByCode enregistre aussi l'ami en local : on retient avant s'il était déjà connu.
    const wasKnown = readFriends().some(f => f.snapshot.id === friend.id);
    if (friend.code) {
      // Action explicite (bouton Ajouter) : compte anonyme créé si besoin. Échec : ami ajouté en local uniquement, message clair.
      const code = friend.code;
      const online = await runWithSession(() => addFriendByCode(code));
      if (online.ok && online.value) {
        // La carte du serveur fait foi (déjà enregistrée par addFriendByCode) : jamais écrasée par celle du lien, qui peut être forgée.
        setMutual(true);
        setFriend(online.value);
      } else {
        if (!online.silent) toast.show(online.message ?? 'Ajouté sur ce téléphone. Il ne te verra pas encore chez lui.');
        // Hors ligne : la carte du lien n'est gardée que pour un nouvel ami, jamais par-dessus une carte déjà enregistrée.
        if (!wasKnown) upsertFriend(friend);
      }
    } else {
      upsertFriend(friend);
    }
    if (wasKnown) return setStatus('updated');
    awardXp(XP.friend);
    unlockAchievement('friend_1');
    if (readFriends().length >= 5) unlockAchievement('friends_5');
    track('friend_added', { method: 'link' });
    setStatus('added');
  };

  const sendBack = async () => {
    if (!me || !friend) return;
    const url = await friendLink(me, 'full');
    const outcome = await shareLink({ title: 'Ma carte Fooder', text: `${friend.name}, voici ma carte Fooder pour qu’on soit amis des deux côtés :`, url });
    if (outcome === 'shared' || outcome === 'copied') track('share', { kind: 'profile' });
    const msg = outcomeLabel(outcome);
    if (msg) toast.show(msg);
  };

  if (status === 'loading' || !me) return <div className='h-full' />;

  if (status === 'invalid' || !friend) {
    return (
      <div className='h-full flex flex-col items-center justify-center text-center px-8 gap-4'>
        <Sticker name='b_bolt' size={96} rotate={-8} />
        <h1 className='text-3xl text-plum'>Lien illisible</h1>
        <p className='text-sm font-medium text-slate-600'>Ce lien d’ami est incomplet ou abîmé. Demande à ton ami de te le renvoyer.</p>
        <Link href='/amis' className='duo-button bg-bubblegum text-plum px-8 py-3.5'>Mes amis</Link>
      </div>
    );
  }

  const match = foodMatch(me, friend);

  return (
    <div className='h-full scroll-y px-4 py-6 space-y-4'>
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className='bg-white rounded-[32px] panel p-5 flex flex-col items-center text-center gap-3'
      >
        <Avatar avatar={friend.avatar} size={96} />
        <div>
          <h1 className='text-[32px] leading-none text-plum'>{friend.name}</h1>
          <p className='text-xs font-bold text-plum/60 mt-1'>niv. {friend.level} · {friend.archetype}</p>
        </div>

        {status === 'self' ? (
          <p className='text-sm font-bold text-plum'>C’est ta propre carte ! Envoie-la à tes amis.</p>
        ) : (
          <>
            <MatchBadge match={match} size='lg' />
            <p className='font-display text-xl text-plum'>{match.verdict}</p>
            {match.score === null && (
              <p className='text-sm font-medium text-slate-600'>Swipe quelques restos pour révéler votre compatibilité.</p>
            )}
            {match.common.length > 0 && (
              <p className='text-sm font-medium text-slate-600'>
                Vous aimez tous les deux <b className='text-plum'>{match.common.slice(0, 2).map(c => c.name).join(' et ')}</b>.
              </p>
            )}
            {match.toDiscover && (
              <p className='text-xs font-medium text-slate-600'>
                Son péché mignon que tu n’as jamais liké : <b className='text-plum'>{match.toDiscover}</b>.
              </p>
            )}
          </>
        )}
      </motion.section>

      {status === 'update' && (
        <button onClick={add} className='w-full duo-button bg-fooder-secondary text-plum py-4 text-lg'>
          Mettre à jour la carte de {friend.name}
        </button>
      )}

      {status === 'preview' && (
        <>
          <p role='note' className='text-center text-xs font-bold text-plum/70'>
            Vérifie que c’est bien la bonne personne : ce nom vient du lien, qui peut avoir été modifié. Le vrai profil s’affichera après l’ajout.
          </p>
          <button onClick={add} className='w-full duo-button bg-bubblegum text-plum py-4 text-lg flex items-center justify-center gap-2'>
            <UserPlus className='w-5 h-5' strokeWidth={2.5} /> Ajouter {friend.name}
          </button>
        </>
      )}

      {(status === 'added' || status === 'updated') && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className='space-y-3'>
          <p className='text-center font-display text-2xl text-plum'>
            {status === 'added' ? `${friend.name} est ton ami !` : `Carte de ${friend.name} mise à jour`}
          </p>
          {status === 'added' && <p className='text-center text-sm font-bold text-plum/70'>+{XP.friend} XP</p>}
          {mutual ? (
            <p className='text-center text-sm font-bold text-plum'>Vous êtes amis des deux côtés, tu apparais déjà chez {friend.name}.</p>
          ) : (
            <>
              <button onClick={sendBack} className='w-full duo-button bg-fooder-secondary text-plum py-4 text-base flex items-center justify-center gap-2'>
                <Share2 className='w-5 h-5' strokeWidth={2.5} /> Envoie-lui ta carte en retour
              </button>
              <p className='text-center text-xs font-medium text-slate-600'>
                Sans ça, tu n’apparais pas encore chez {friend.name}.{' '}
                {auth.enabled && !auth.session && <Link href='/compte' className='underline font-bold'>Avec un compte, c’est automatique.</Link>}
              </p>
            </>
          )}
        </motion.div>
      )}

      <div className='grid grid-cols-2 gap-3'>
        <Link href='/amis' className='duo-button bg-white text-plum py-3 text-sm text-center'>Mes amis</Link>
        <Link href='/swipe' className='duo-button bg-white text-plum py-3 text-sm text-center'>Swiper</Link>
      </div>
      {toast.node}
    </div>
  );
}
