'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export function AdminLogin() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }) });
      if (res.ok) {
        setPasscode('');
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? 'Connexion impossible.');
    } catch {
      setError('Pas de connexion au serveur.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='min-h-full flex items-center justify-center px-4 py-12'>
      <form onSubmit={submit} className='w-full max-w-sm bg-white border-[3px] border-plum rounded-3xl shadow-hard-lg p-6 relative'>
        <span className='absolute -top-5 left-6 w-10 h-10 rounded-full bg-fooder-secondary border-[3px] border-plum flex items-center justify-center shadow-hard-sm'>
          <Lock className='w-5 h-5 text-plum' strokeWidth={2.5} aria-hidden />
        </span>
        <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-plum/50 mt-2'>Fooder · QG</p>
        <h1 className='font-display text-3xl leading-tight mt-1'>Backoffice</h1>
        <p className='text-sm font-medium text-plum/70 mt-1'>Accès réservé à l’équipe.</p>
        <label htmlFor='admin-passcode' className='block text-sm font-bold mt-5'>
          Mot de passe
        </label>
        <input
          id='admin-passcode'
          type='password'
          autoComplete='current-password'
          autoFocus
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          className='mt-1.5 w-full rounded-2xl border-[3px] border-plum bg-cream px-4 py-3 font-semibold outline-none focus:bg-white focus:shadow-hard-violet transition-shadow'
        />
        {error && (
          <p role='alert' className='mt-3 text-sm font-bold text-fooder-red'>
            {error}
          </p>
        )}
        <button
          type='submit'
          disabled={busy || !passcode}
          className='mt-5 w-full rounded-full border-[3px] border-plum bg-fooder-primary text-white font-bold py-3 shadow-[0_5px_0_#2B0F3A] active:translate-y-[4px] active:shadow-[0_1px_0_#2B0F3A] disabled:opacity-50 transition-[transform,box-shadow]'
        >
          {busy ? 'Vérification…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
}
