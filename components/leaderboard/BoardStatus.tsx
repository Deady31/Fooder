import Link from 'next/link';
import { Camera, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { Unavailable } from '../../lib/cloud/leaderboard';

const BTN = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full bg-bubblegum border-[3px] border-plum shadow-hard font-black text-sm text-plum active:translate-y-0.5 active:shadow-none transition-all';

export function BoardLoading() {
  return (
    <div role='status' aria-live='polite' className='space-y-3 pt-4'>
      <span className='sr-only'>Chargement du classement…</span>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className='h-14 rounded-2xl border-[3px] border-plum/15 bg-white/70 animate-pulse' />
      ))}
    </div>
  );
}

export function BoardEmpty() {
  return (
    <div className='mt-4 bg-white/80 rounded-3xl border-[3px] border-dashed border-plum p-6 flex flex-col items-center text-center gap-3'>
      <Camera className='w-10 h-10 text-plum' strokeWidth={2.5} aria-hidden />
      <p className='font-display text-xl text-plum'>Personne dans le classement : poste la première photo de plat !</p>
      <Link href='/feed' className={BTN}>Aller au fil</Link>
    </div>
  );
}

const COPY: Record<Unavailable, { title: string; text: string }> = {
  offline: { title: 'Hors ligne', text: 'Le classement revient dès que tu retrouves du réseau.' },
  cloud_off: { title: 'Classement indisponible', text: 'Le classement en ligne n’est pas encore activé sur cette version.' },
  no_session: { title: 'Rejoins le classement', text: 'Active ton profil en ligne (sans mot de passe) pour voir où tu te places.' },
  error: { title: 'Chargement impossible', text: 'Le classement ne répond pas pour l’instant.' },
};

interface BoardUnavailableProps {
  reason: Unavailable;
  onRetry: () => void;
  onActivate?: () => void;
  busy?: boolean;
}

export function BoardUnavailable({ reason, onRetry, onActivate, busy }: BoardUnavailableProps) {
  const copy = COPY[reason];
  const Icon = reason === 'offline' ? WifiOff : CloudOff;
  return (
    <div role='status' className='mt-4 bg-white/80 rounded-3xl border-[3px] border-plum shadow-hard p-6 flex flex-col items-center text-center gap-3'>
      <Icon className='w-10 h-10 text-plum' strokeWidth={2.5} aria-hidden />
      <p className='font-display text-xl text-plum'>{copy.title}</p>
      <p className='text-sm font-medium text-slate-600'>{copy.text}</p>
      {reason === 'no_session' && onActivate ? (
        <button onClick={onActivate} disabled={busy} className={BTN}>{busy ? 'Activation…' : 'Activer mon profil en ligne'}</button>
      ) : reason !== 'cloud_off' ? (
        <button onClick={onRetry} className={BTN}><RefreshCw className='w-4 h-4' strokeWidth={3} aria-hidden />Réessayer</button>
      ) : null}
    </div>
  );
}
