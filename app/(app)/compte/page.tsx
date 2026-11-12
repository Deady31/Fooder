'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CloudOff, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { Sticker } from '../../../components/ui/Sticker';
import { useAuth } from '../../../components/auth/AuthProvider';
import { EmailCodeFlow } from '../../../components/auth/EmailCodeFlow';
import { UsageToggle } from '../../../components/auth/UsageToggle';
import { deleteAccount } from '../../../lib/cloud/social';

const SYNC_LABEL = { off: 'Hors ligne', syncing: 'Synchronisation…', ok: 'Tout est sauvegardé', error: 'Synchro en échec, on réessaie' } as const;

const LEGAL_NOTE = (
  <p className='text-[11px] font-medium text-slate-500'>
    En continuant, tu acceptes les <Link href='/legal/terms' className='underline'>conditions</Link> et la{' '}
    <Link href='/legal/privacy' className='underline'>politique de confidentialité</Link>.
  </p>
);

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Compte anonyme : on propose d'abord de le sauvegarder ; si l'e-mail existe déjà, on bascule sur la connexion
  const [anonMode, setAnonMode] = useState<'upgrade' | 'signin'>('upgrade');
  const [prefill, setPrefill] = useState('');

  const remove = async () => {
    if (!auth.uid) return;
    setBusy(true);
    const ok = await deleteAccount(auth.uid);
    setBusy(false);
    if (!ok) return setError('Suppression impossible pour le moment. Réessaie ou écris-nous.');
    router.push('/profile');
  };

  const deleteBlock = (
    <section className='rounded-[28px] border-[3px] border-dashed border-plum/40 p-4 space-y-2'>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className='text-xs font-bold text-fooder-red underline underline-offset-2'>
          Supprimer mon compte
        </button>
      ) : (
        <div className='space-y-2'>
          <p className='text-sm font-bold text-plum'>
            Supprimer définitivement ton compte, tes photos publiées et tes amitiés ? Cette action est irréversible. Les données de ce téléphone restent.
          </p>
          <div className='grid grid-cols-2 gap-2'>
            <button onClick={() => setConfirmDelete(false)} className='duo-button bg-white text-plum py-3 text-sm'>Annuler</button>
            <button onClick={remove} disabled={busy} className='duo-button bg-fooder-red text-white py-3 text-sm disabled:opacity-60'>Supprimer</button>
          </div>
        </div>
      )}
      {error && <p role='alert' className='text-sm font-bold text-fooder-red'>{error}</p>}
    </section>
  );

  const syncBadge = (
    <div className={`flex items-center gap-2 rounded-2xl border-[3px] border-plum px-3 py-2 text-sm font-bold text-plum ${auth.sync === 'error' ? 'bg-fooder-orange' : 'bg-fooder-mint'}`}>
      <ShieldCheck className='w-4 h-4' strokeWidth={2.5} />
      <span className='flex-1'>{SYNC_LABEL[auth.sync]}</span>
      <button onClick={auth.syncNow} aria-label='Synchroniser maintenant' className='-my-1.5 -mr-1.5 w-11 h-11 flex items-center justify-center'>
        <span className='w-8 h-8 rounded-full bg-white border-2 border-plum flex items-center justify-center'>
          <RefreshCw className={`w-4 h-4 ${auth.sync === 'syncing' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        </span>
      </button>
    </div>
  );

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title='Compte'
        subtitle='Sauvegarde, amis et groupes en direct'
        right={
          <Link href='/profile' aria-label='Retour au profil' className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard shrink-0'>
            <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
          </Link>
        }
      />

      <div className='flex-1 min-h-0 scroll-y px-4 py-5 space-y-4'>
        {!auth.enabled ? (
          <section className='bg-white rounded-[28px] panel p-5 text-center flex flex-col items-center gap-2'>
            <CloudOff className='w-10 h-10 text-plum' strokeWidth={2} />
            <h2 className='text-2xl text-plum'>Comptes bientôt disponibles</h2>
            <p className='text-sm font-medium text-slate-600'>Pour l’instant, tout reste sur ce téléphone. Rien n’est perdu : tes données seront reprises à la création du compte.</p>
          </section>
        ) : auth.loading ? (
          <p className='text-center text-sm font-bold text-plum/60'>Chargement…</p>
        ) : auth.session && !auth.anonymous ? (
          <>
            <section className='bg-white rounded-[28px] panel p-5 space-y-3'>
              <div className='flex items-center gap-3'>
                <Sticker name='b_heart' size={56} rotate={-8} />
                <div className='min-w-0'>
                  <p className='text-xs font-bold text-plum/60'>Connecté avec</p>
                  <p className='font-bold text-plum truncate'>{auth.email}</p>
                </div>
              </div>
              {syncBadge}
              <ul className='text-xs font-medium text-slate-600 space-y-1'>
                <li>• Likes, visites, XP et trophées sauvegardés sur ton compte.</li>
                <li>• Amitiés réciproques automatiques, cartes toujours à jour.</li>
                <li>• Votes de groupe en direct, vraies photos visibles par tous.</li>
              </ul>
            </section>

            <button onClick={auth.signOut} className='w-full duo-button bg-white text-plum py-3.5 text-sm flex items-center justify-center gap-2'>
              <LogOut className='w-4 h-4' /> Se déconnecter
            </button>
            <UsageToggle />
            {deleteBlock}
          </>
        ) : auth.session ? (
          <>
            <section className='bg-white rounded-[28px] panel p-5 space-y-4'>
              <div className='flex items-center gap-3'>
                <Sticker name='b_star' size={56} rotate={-8} />
                <div>
                  <h2 className='text-2xl text-plum leading-none'>{anonMode === 'upgrade' ? 'Sauvegarde ton compte' : 'Connecte-toi'}</h2>
                  <p className='text-xs font-medium text-slate-600 mt-1'>
                    {anonMode === 'upgrade'
                      ? 'Tes amis et ta progression sont déjà liés à ce téléphone. Ajoute un e-mail pour les retrouver si tu changes d’appareil.'
                      : 'Tu retrouves ton compte, et les données de ce téléphone y sont fusionnées.'}
                  </p>
                </div>
              </div>
              {syncBadge}
              <EmailCodeFlow
                key={anonMode}
                mode={anonMode === 'upgrade' ? 'upgrade' : 'signin'}
                initialEmail={prefill}
                onSend={anonMode === 'upgrade' ? auth.sendUpgradeCode : auth.sendCode}
                onVerify={anonMode === 'upgrade' ? auth.verifyUpgradeCode : auth.verifyCode}
                onEmailExists={email => {
                  setPrefill(email);
                  setAnonMode('signin');
                }}
              />
              {anonMode === 'upgrade' ? (
                <button type='button' onClick={() => setAnonMode('signin')} className='w-full text-xs font-bold text-plum/60 underline'>
                  J’ai déjà un compte Fooder
                </button>
              ) : (
                <button type='button' onClick={() => setAnonMode('upgrade')} className='w-full text-xs font-bold text-plum/60 underline'>
                  Plutôt sauvegarder ce compte
                </button>
              )}
              <p className='text-[11px] font-medium text-slate-500'>
                Sans e-mail, ces données ne sont pas récupérables si tu perds ou réinitialises ce téléphone.
              </p>
              {LEGAL_NOTE}
            </section>
            <UsageToggle />
            {deleteBlock}
          </>
        ) : (
          <>
            <section className='bg-white rounded-[28px] panel p-5 space-y-4'>
              <div className='flex items-center gap-3'>
                <Sticker name='b_star' size={56} rotate={-8} />
                <div>
                  <h2 className='text-2xl text-plum leading-none'>Connecte-toi</h2>
                  <p className='text-xs font-medium text-slate-600 mt-1'>
                    Pas besoin de compte pour jouer. Sans mot de passe : on t’envoie un code par e-mail.
                  </p>
                </div>
              </div>
              <EmailCodeFlow mode='signin' onSend={auth.sendCode} onVerify={auth.verifyCode} />
              <p className='text-[11px] font-medium text-slate-500'>Tes likes et ta progression actuels sont repris dans le compte.</p>
              {LEGAL_NOTE}
            </section>
            <UsageToggle />
          </>
        )}
      </div>
    </div>
  );
}
