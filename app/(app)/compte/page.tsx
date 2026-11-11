'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CloudOff, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { Sticker } from '../../../components/ui/Sticker';
import { useAuth } from '../../../components/auth/AuthProvider';
import { deleteAccount } from '../../../lib/cloud/social';

const SYNC_LABEL = { off: 'Hors ligne', syncing: 'Synchronisation…', ok: 'Tout est sauvegardé', error: 'Synchro en échec, on réessaie' } as const;

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    const err = await auth.sendCode(email);
    setBusy(false);
    if (err) setError(err);
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const err = await auth.verifyCode(email, code);
    setBusy(false);
    if (err) setError(err);
  };

  const remove = async () => {
    if (!auth.uid) return;
    setBusy(true);
    const ok = await deleteAccount(auth.uid);
    setBusy(false);
    if (!ok) return setError('Suppression impossible pour le moment. Réessaie ou écris-nous.');
    router.push('/profile');
  };

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
        ) : auth.session ? (
          <>
            <section className='bg-white rounded-[28px] panel p-5 space-y-3'>
              <div className='flex items-center gap-3'>
                <Sticker name='b_heart' size={56} rotate={-8} />
                <div className='min-w-0'>
                  <p className='text-xs font-bold text-plum/60'>Connecté avec</p>
                  <p className='font-bold text-plum truncate'>{auth.email}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-2xl border-[3px] border-plum px-3 py-2 text-sm font-bold text-plum ${auth.sync === 'error' ? 'bg-fooder-orange' : 'bg-fooder-mint'}`}>
                <ShieldCheck className='w-4 h-4' strokeWidth={2.5} />
                <span className='flex-1'>{SYNC_LABEL[auth.sync]}</span>
                <button onClick={auth.syncNow} aria-label='Synchroniser maintenant' className='w-8 h-8 rounded-full bg-white border-2 border-plum flex items-center justify-center'>
                  <RefreshCw className={`w-4 h-4 ${auth.sync === 'syncing' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
                </button>
              </div>
              <ul className='text-xs font-medium text-slate-600 space-y-1'>
                <li>• Likes, visites, XP et trophées sauvegardés sur ton compte.</li>
                <li>• Amitiés réciproques automatiques, cartes toujours à jour.</li>
                <li>• Votes de groupe en direct, vraies photos visibles par tous.</li>
              </ul>
            </section>

            <button onClick={auth.signOut} className='w-full duo-button bg-white text-plum py-3.5 text-sm flex items-center justify-center gap-2'>
              <LogOut className='w-4 h-4' /> Se déconnecter
            </button>

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
            </section>
          </>
        ) : (
          <section className='bg-white rounded-[28px] panel p-5 space-y-4'>
            <div className='flex items-center gap-3'>
              <Sticker name='b_star' size={56} rotate={-8} />
              <div>
                <h2 className='text-2xl text-plum leading-none'>Crée ton compte</h2>
                <p className='text-xs font-medium text-slate-600 mt-1'>Sans mot de passe : on t’envoie un lien de connexion par e-mail.</p>
              </div>
            </div>

            {step === 'email' ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  send();
                }}
                className='space-y-3'
              >
                <label htmlFor='email' className='block text-[11px] font-black text-plum/60'>Ton e-mail</label>
                <input
                  id='email'
                  type='email'
                  inputMode='email'
                  autoComplete='email'
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder='toi@exemple.fr'
                  className='w-full rounded-xl border-[3px] border-plum px-3 py-2.5 font-bold text-plum'
                />
                <button type='submit' disabled={busy} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60'>
                  <Mail className='w-4 h-4' strokeWidth={2.5} /> {busy ? 'Envoi…' : 'Recevoir mon lien'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  verify();
                }}
                className='space-y-3'
              >
                <div className='rounded-2xl bg-fooder-mint/40 border-[3px] border-plum p-3 space-y-1'>
                  <p className='text-sm font-bold text-plum'>E-mail envoyé à {email}</p>
                  <p className='text-xs font-medium text-slate-600'>
                    Ouvre-le et touche « Sign in » <b>depuis ce même navigateur</b> : tu reviendras ici, connecté. Pense à regarder les spams.
                  </p>
                </div>
                <p className='text-[11px] font-bold text-plum/60'>Ton e-mail contient un code à la place ? Saisis-le ici :</p>
                <input
                  type='text'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  maxLength={8}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder='123456'
                  aria-label='Code reçu par e-mail'
                  className='w-full rounded-xl border-[3px] border-plum px-3 py-2.5 font-display text-3xl tracking-[0.3em] text-center text-plum'
                />
                <button type='submit' disabled={busy} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base disabled:opacity-60'>
                  {busy ? 'Vérification…' : 'Valider'}
                </button>
                <button type='button' onClick={() => setStep('email')} className='w-full text-xs font-bold text-plum/60 underline'>
                  Changer d’e-mail ou renvoyer un code
                </button>
              </form>
            )}
            {error && <p className='text-sm font-bold text-fooder-red'>{error}</p>}
            <p className='text-[11px] font-medium text-slate-500'>
              Tes likes et ta progression actuels sont repris dans le compte. En continuant, tu acceptes les{' '}
              <Link href='/legal/terms' className='underline'>conditions</Link> et la <Link href='/legal/privacy' className='underline'>politique de confidentialité</Link>.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
