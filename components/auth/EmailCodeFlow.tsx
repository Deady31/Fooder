'use client';
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import type { AuthResult } from './AuthProvider';

const RESEND_DELAY_S = 60;
const MAX_WRONG_CODES = 5;

interface Props {
  mode: 'signin' | 'upgrade';
  initialEmail?: string;
  onSend: (email: string) => Promise<AuthResult>;
  onVerify: (email: string, code: string) => Promise<AuthResult>;
  /** Mode « upgrade » seulement : l'adresse a déjà un compte, on propose de s'y connecter. */
  onEmailExists?: (email: string) => void;
}

/** Saisie de l'e-mail puis du code à 6 chiffres (ou lien), avec renvoi différé et gestion des erreurs. */
export function EmailCodeFlow({ mode, initialEmail = '', onSend, onVerify, onEmailExists }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [wrong, setWrong] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setExists(false);
    let res: Awaited<ReturnType<typeof onSend>>;
    try {
      res = await onSend(email);
    } finally {
      setBusy(false);
    }
    if (res.ok) {
      setStep('code');
      setCode('');
      setWrong(0);
      setCooldown(RESEND_DELAY_S);
      return;
    }
    if (res.reason === 'rate_limit') setCooldown(RESEND_DELAY_S);
    if (res.reason === 'email_exists' && mode === 'upgrade') setExists(true);
    else setError(res.message ?? null);
  };

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res: Awaited<ReturnType<typeof onVerify>>;
    try {
      res = await onVerify(email, code);
    } finally {
      setBusy(false);
    }
    if (res.ok) return;
    if (res.reason === 'network') {
      setError(res.message ?? null);
      return;
    }
    const count = wrong + 1;
    setWrong(count);
    setCode('');
    if (res.reason === 'code_invalid' && count >= MAX_WRONG_CODES) {
      setError('Trop d’essais. Demande un nouveau code.');
      setStep('email');
      return;
    }
    setError(res.message ?? null);
  };

  if (exists) {
    return (
      <div className='space-y-3'>
        <div className='rounded-2xl bg-fooder-mint/40 border-[3px] border-plum p-3 space-y-1'>
          <p className='text-sm font-bold text-plum'>Cette adresse a déjà un compte Fooder.</p>
          <p className='text-xs font-medium text-slate-600'>
            Connecte-toi : les likes, visites et la progression de ce téléphone seront fusionnés avec ceux du compte. Rien n’est effacé.
          </p>
        </div>
        <button type='button' onClick={() => onEmailExists?.(email)} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base'>
          Me connecter à ce compte
        </button>
        <button type='button' onClick={() => setExists(false)} className='w-full text-xs font-bold text-plum/60 underline'>
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {step === 'email' ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            send();
          }}
          className='space-y-3'
        >
          <label htmlFor={`email-${mode}`} className='block text-[11px] font-black text-plum/60'>Ton e-mail</label>
          <input
            id={`email-${mode}`}
            type='email'
            inputMode='email'
            autoComplete='email'
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder='toi@exemple.fr'
            className='w-full rounded-xl border-[3px] border-plum px-3 py-2.5 font-bold text-plum'
          />
          <button type='submit' disabled={busy || cooldown > 0} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60'>
            <Mail className='w-4 h-4' strokeWidth={2.5} />
            {busy ? 'Envoi…' : cooldown > 0 ? `Patiente ${cooldown} s` : mode === 'upgrade' ? 'Recevoir mon code' : 'Recevoir mon code ou lien'}
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
            <p className='text-sm font-bold text-plum break-words'>E-mail envoyé à {email}</p>
            <p className='text-xs font-medium text-slate-600'>
              Saisis le code à 6 chiffres reçu : ça marche aussi dans l’appli installée. Tu peux aussi toucher le lien de l’e-mail depuis ce même navigateur. Pense aux spams.
            </p>
          </div>
          <label htmlFor={`code-${mode}`} className='block text-[11px] font-black text-plum/60'>Code à 6 chiffres</label>
          <input
            id={`code-${mode}`}
            type='text'
            inputMode='numeric'
            autoComplete='one-time-code'
            maxLength={8}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder='123456'
            className='w-full rounded-xl border-[3px] border-plum px-3 py-2.5 font-display text-3xl tracking-[0.3em] text-center text-plum'
          />
          <button type='submit' disabled={busy || code.length < 6} className='w-full duo-button bg-bubblegum text-plum py-3.5 text-base disabled:opacity-60'>
            {busy ? 'Vérification…' : 'Valider'}
          </button>
          <div className='flex items-center justify-between gap-2 text-xs font-bold text-plum/60'>
            <button type='button' onClick={() => { setStep('email'); setError(null); }} className='underline'>
              Changer d’e-mail
            </button>
            <button type='button' onClick={send} disabled={busy || cooldown > 0} className='underline disabled:no-underline disabled:opacity-60'>
              {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
            </button>
          </div>
        </form>
      )}
      {error && <p role='alert' className='text-sm font-bold text-fooder-red'>{error}</p>}
    </div>
  );
}
