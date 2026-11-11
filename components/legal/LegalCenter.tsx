'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Download, Trash2 } from 'lucide-react';

const LINKS: { href: string; label: string; hint: string }[] = [
  { href: '/legal/terms', label: "Conditions d'utilisation", hint: 'CGU, Premium, médiation' },
  { href: '/legal/privacy', label: 'Confidentialité (RGPD)', hint: 'Tes données et tes droits' },
  { href: '/legal/cookies', label: 'Cookies et mesure d’audience', hint: 'Stockage et consentement' },
  { href: '/legal/community', label: 'Règles de la communauté', hint: 'Fil, photos, signalement' },
  { href: '/legal/mentions', label: 'Mentions légales', hint: 'Éditeur et hébergeur' },
  { href: '/legal/credits', label: 'Licences et crédits', hint: 'OpenStreetMap, polices' },
];

function localKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('fooder_')) keys.push(k);
  }
  return keys;
}

export function LegalCenter() {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const exportData = () => {
    try {
      const data: Record<string, unknown> = {};
      for (const k of localKeys()) {
        const raw = localStorage.getItem(k);
        try {
          data[k] = raw ? JSON.parse(raw) : null;
        } catch {
          data[k] = raw;
        }
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mes-donnees-fooder.json';
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export téléchargé.');
    } catch {
      setMessage("L'export a échoué.");
    }
  };

  const wipe = () => {
    try {
      localKeys().forEach(k => localStorage.removeItem(k));
      setMessage('Données supprimées. Redémarrage…');
      setTimeout(() => window.location.assign('/onboarding'), 700);
    } catch {
      setMessage('Suppression impossible.');
    }
  };

  return (
    <section aria-labelledby='legal-title' className='mt-6'>
      <h2 id='legal-title' className='font-display text-xl text-plum mb-2'>Légal et données</h2>

      <ul className='bg-white panel rounded-3xl overflow-hidden divide-y-2 divide-dashed divide-plum/15'>
        {LINKS.map(l => (
          <li key={l.href}>
            <Link href={l.href} className='flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-cream'>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-bold text-plum'>{l.label}</span>
                <span className='block text-[11px] font-semibold text-plum/50'>{l.hint}</span>
              </span>
              <ChevronRight className='w-4 h-4 text-plum/50 shrink-0' strokeWidth={3} />
            </Link>
          </li>
        ))}
      </ul>

      <div className='mt-3 bg-white panel rounded-3xl p-4 space-y-3'>
        <p className='text-sm font-bold text-plum'>Mes données</p>
        <p className='text-xs font-semibold text-slate-600 leading-snug'>
          Tout est enregistré sur ce téléphone. Tu peux le récupérer ou tout effacer.
        </p>
        <button onClick={exportData} className='duo-button w-full bg-white text-plum text-sm flex items-center justify-center gap-2'>
          <Download className='w-4 h-4' strokeWidth={3} /> Exporter mes données
        </button>
        {confirming ? (
          <div className='rounded-2xl border-[3px] border-fooder-red p-3 space-y-2'>
            <p className='text-xs font-bold text-plum'>Supprimer likes, niveau, posts et préférences ? C&apos;est définitif.</p>
            <div className='flex gap-2'>
              <button onClick={() => setConfirming(false)} className='duo-button flex-1 bg-white text-plum text-sm'>Annuler</button>
              <button onClick={wipe} className='duo-button flex-1 bg-fooder-red text-white text-sm'>Supprimer</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className='duo-button w-full bg-white text-fooder-red text-sm flex items-center justify-center gap-2'>
            <Trash2 className='w-4 h-4' strokeWidth={3} /> Supprimer mes données
          </button>
        )}
        {message && <p role='status' className='text-xs font-bold text-plum/70 text-center'>{message}</p>}
      </div>

      <p className='mt-4 text-center text-[10px] font-semibold text-plum/40'>Fooder · version de test · Toulouse</p>
    </section>
  );
}
