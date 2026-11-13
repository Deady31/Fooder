'use client';
import { useEffect, useState } from 'react';
import { Copy, Image as ImageIcon, MessageCircle, QrCode as QrIcon, Share2 } from 'lucide-react';
import { Sticker } from '../ui/Sticker';
import { useToast } from '../ui/Toast';
import { QrCode } from './QrCode';
import { InstallPrompt } from '../pwa/InstallPrompt';
import { formatCode, inviteText, inviteUrl, defaultOrigin, myInviteCode, shareInvite, whatsappUrl } from '../../lib/invite';
import { outcomeLabel, shareImage } from '../../lib/share';
import { renderInviteStory } from '../../lib/cardImage';
import { track } from '../../lib/analytics';

interface InviteCardProps {
  /** « banner » : bandeau discret d'une ligne ; « full » : carte complète. */
  variant?: 'full' | 'banner';
  /** Affiche l'invitation à installer sous la carte (désactiver si déjà montée sur la page). */
  showInstall?: boolean;
  className?: string;
}

/** « Invite tes potes » : partage natif, copie du lien, WhatsApp, story et QR code. Aucune récompense XP (farmable). */
export function InviteCard({ variant = 'full', showInstall = true, className = '' }: InviteCardProps) {
  const [code, setCode] = useState<string | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const c = myInviteCode();
    setCode(c);
    setUrl(inviteUrl(defaultOrigin(), c));
  }, []);

  const share = async () => {
    const outcome = await shareInvite(code);
    const msg = outcomeLabel(outcome);
    if (msg) toast.show(msg);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      track('share', { kind: 'app' });
      toast.show('Lien copié');
    } catch {
      toast.show('Copie impossible sur cet appareil');
    }
  };

  const story = async () => {
    setBusy(true);
    try {
      const blob = await renderInviteStory(code, url);
      const outcome = await shareImage(blob, 'fooder-invitation.png', inviteText());
      if (outcome === 'shared' || outcome === 'copied') track('share', { kind: 'app' });
      if (outcome === 'copied') toast.show('Image enregistrée, publie-la en story');
    } catch {
      toast.show('Impossible de créer l’image sur cet appareil');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'banner') {
    return (
      <>
        <button
          onClick={share}
          className={`w-full flex items-center gap-3 bg-white/80 rounded-3xl border-[3px] border-dashed border-plum p-3 text-left active:translate-y-0.5 ${className}`}
        >
          <Sticker name='b_heart' size={40} rotate={-8} />
          <span className='flex-1 min-w-0'>
            <span className='block font-display text-base text-plum leading-tight'>Invite tes potes</span>
            <span className='block text-xs font-bold text-plum-muted'>Mangez ensemble, comparez vos goûts</span>
          </span>
          <Share2 className='w-5 h-5 text-plum shrink-0' strokeWidth={2.5} />
        </button>
        {toast.node}
      </>
    );
  }

  const wa = url ? whatsappUrl(inviteText(), url) : '#';

  return (
    <div className={`space-y-3 ${className}`}>
      <section className='bg-lemon rounded-[28px] panel p-4 space-y-3' aria-label='Invite tes potes'>
        <div className='flex items-center gap-3'>
          <Sticker name='b_heart' size={64} rotate={-8} className='bob shrink-0' />
          <div className='min-w-0'>
            <p className='font-display text-2xl text-plum leading-tight'>Invite tes potes</p>
            <p className='text-xs font-bold text-plum-muted leading-snug'>Plus on est de fous, plus on mange bien. Envoie-leur ton lien.</p>
          </div>
        </div>

        {formatCode(code) && (
          <p className='text-xs font-bold text-plum-muted'>
            Ton code d’ami : <span className='font-display text-base text-plum tracking-wide'>{formatCode(code)}</span>
          </p>
        )}

        <button onClick={share} className='duo-button w-full bg-bubblegum text-plum py-3 text-sm flex items-center justify-center gap-2'>
          <Share2 className='w-4 h-4' strokeWidth={2.5} /> Partager mon invitation
        </button>

        <div className='grid grid-cols-2 gap-2.5'>
          <button onClick={copy} className='duo-button bg-white text-plum py-2.5 text-sm flex items-center justify-center gap-2'>
            <Copy className='w-4 h-4' strokeWidth={2.5} /> Copier le lien
          </button>
          <a
            href={wa}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => track('share', { kind: 'app' })}
            className='duo-button bg-fooder-mint text-plum py-2.5 text-sm flex items-center justify-center gap-2'
          >
            <MessageCircle className='w-4 h-4' strokeWidth={2.5} /> WhatsApp
          </a>
          <button onClick={story} disabled={busy} className='duo-button bg-fooder-secondary text-plum py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60'>
            <ImageIcon className='w-4 h-4' strokeWidth={2.5} /> {busy ? 'Création…' : 'Story'}
          </button>
          <button onClick={() => setQrOpen(o => !o)} aria-expanded={qrOpen} className='duo-button bg-white text-plum py-2.5 text-sm flex items-center justify-center gap-2'>
            <QrIcon className='w-4 h-4' strokeWidth={2.5} /> QR code
          </button>
        </div>

        {qrOpen && url && (
          <div className='flex justify-center'>
            <div className='p-1.5 bg-white rounded-2xl border-[3px] border-plum'>
              <QrCode value={url} size={160} alt='QR code de ton invitation Fooder' />
            </div>
          </div>
        )}
      </section>

      {showInstall && <InstallPrompt />}
      {toast.node}
    </div>
  );
}
