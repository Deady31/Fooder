'use client';
import { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Pencil, Share2 } from 'lucide-react';
import { Avatar } from '../profile/Avatar';
import { QrCode } from './QrCode';
import { FriendSnapshot } from '../../lib/social/snapshot';
import { friendLink } from '../../lib/social/friends';
import { MAX_NAME, renameMe } from '../../lib/identity';
import { outcomeLabel, shareImage, shareLink } from '../../lib/share';
import { renderFriendCard } from '../../lib/cardImage';
import { track } from '../../lib/analytics';

interface MyCardProps {
  snapshot: FriendSnapshot;
  title: string;
  onToast: (msg: string) => void;
}

/** Ma carte d'ami : pseudo, QR code à scanner à table, lien et image à partager. */
export function MyCard({ snapshot, title, onToast }: MyCardProps) {
  const [qrLink, setQrLink] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(snapshot.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    friendLink(snapshot, 'qr').then(setQrLink);
  }, [snapshot]);

  useEffect(() => setName(snapshot.name), [snapshot.name]);

  const saveName = () => {
    renameMe(name);
    setEditing(false);
  };

  const shareMyLink = async () => {
    const url = await friendLink(snapshot, 'full');
    const outcome = await shareLink({ title: 'Ma carte Fooder', text: `Ajoute-moi sur Fooder et compare nos goûts (${snapshot.archetype}) :`, url });
    track('friend_link_shared', { outcome });
    if (outcome === 'shared' || outcome === 'copied') track('share', { kind: 'profile' });
    const msg = outcomeLabel(outcome);
    if (msg) onToast(msg);
  };

  const shareMyImage = async () => {
    setBusy(true);
    try {
      const url = await friendLink(snapshot, 'qr');
      const blob = await renderFriendCard(snapshot, url, title);
      const outcome = await shareImage(blob, `fooder-${snapshot.name}.png`, 'Ma carte Fooder');
      track('friend_card_shared', { outcome });
      if (outcome === 'shared' || outcome === 'copied') track('share', { kind: 'profile' });
      if (outcome === 'copied') onToast('Image enregistrée, publie-la en story');
    } catch {
      onToast('Impossible de créer l’image sur cet appareil');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className='bg-white rounded-[28px] panel p-4 space-y-4'>
      <div className='flex items-center gap-3'>
        <Avatar avatar={snapshot.avatar} size={60} />
        <div className='flex-1 min-w-0'>
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                saveName();
              }}
              className='flex gap-2'
            >
              <input
                autoFocus
                value={name}
                maxLength={MAX_NAME}
                onChange={e => setName(e.target.value)}
                aria-label='Ton pseudo'
                className='flex-1 min-w-0 rounded-xl border-[3px] border-plum px-2 py-1 font-bold text-plum'
              />
              <button type='submit' aria-label='Valider le pseudo' className='w-9 h-9 shrink-0 rounded-full bg-fooder-mint border-[3px] border-plum flex items-center justify-center'>
                <Check className='w-4 h-4' strokeWidth={3} />
              </button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} className='flex items-center gap-1.5 max-w-full' aria-label='Modifier ton pseudo'>
              <span className='font-display text-2xl text-plum truncate'>{snapshot.name}</span>
              <Pencil className='w-3.5 h-3.5 text-plum/50 shrink-0' strokeWidth={3} />
            </button>
          )}
          <p className='text-xs font-bold text-plum/60 truncate'>{title} · niv. {snapshot.level} · {snapshot.archetype}</p>
        </div>
      </div>

      <div className='flex items-center gap-4'>
        <div className='p-1.5 bg-white rounded-2xl border-[3px] border-plum shrink-0'>
          <QrCode value={qrLink} size={128} />
        </div>
        <div className='space-y-1.5'>
          <p className='font-display text-lg text-plum leading-tight'>Fais-moi scanner</p>
          <p className='text-xs font-medium text-slate-600 leading-snug'>
            À table, ton ami ouvre l’appareil photo, scanne, et vous découvrez votre Food Match.
          </p>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-2.5'>
        <button onClick={shareMyLink} className='duo-button bg-bubblegum text-plum py-3 text-sm flex items-center justify-center gap-2'>
          <Share2 className='w-4 h-4' strokeWidth={2.5} /> Envoyer
        </button>
        <button onClick={shareMyImage} disabled={busy} className='duo-button bg-fooder-secondary text-plum py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60'>
          <ImageIcon className='w-4 h-4' strokeWidth={2.5} /> {busy ? 'Création…' : 'Story'}
        </button>
      </div>
    </section>
  );
}
