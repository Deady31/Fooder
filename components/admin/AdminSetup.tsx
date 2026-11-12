/** Écran affiché quand des variables d'environnement manquent : explique quoi créer, sans jamais afficher de valeur. */

const HELP: Record<string, string> = {
  ADMIN_PASSCODE: 'Mot de passe du backoffice (8 caractères minimum, choisis-en un long).',
  ADMIN_SESSION_SECRET: 'Secret de signature du cookie (32 caractères minimum, aléatoire).',
  SUPABASE_SERVICE_ROLE_KEY: 'Clé « service_role » (ou « secret ») de Supabase : Project Settings → API. Serveur uniquement.',
  NEXT_PUBLIC_SUPABASE_URL: 'Adresse du projet Supabase (https://xxxx.supabase.co).',
};

export function AdminSetup({ missing }: { missing: string[] }) {
  return (
    <div className='max-w-2xl mx-auto px-4 py-10 sm:py-16'>
      <p className='inline-block bg-fooder-secondary border-[3px] border-plum rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] shadow-hard-sm'>Backoffice · configuration</p>
      <h1 className='font-display text-4xl sm:text-5xl mt-4 leading-[1.05]'>Il manque quelques réglages.</h1>
      <p className='mt-3 text-base font-medium text-plum/75'>
        Le backoffice lit les chiffres côté serveur avec une clé secrète. Ajoute ces variables (Vercel → Settings → Environment Variables, ou <code className='font-mono text-sm'>.env.local</code> en local), puis redéploie.
      </p>
      <ul className='mt-6 space-y-3'>
        {missing.map(name => (
          <li key={name} className='bg-white border-[3px] border-plum rounded-2xl shadow-hard p-4'>
            <code className='font-mono text-sm font-bold text-fooder-primary break-all'>{name}</code>
            <p className='text-sm font-medium text-plum/75 mt-1'>{HELP[name] ?? 'Variable requise.'}</p>
          </li>
        ))}
      </ul>
      <div className='mt-6 bg-plum text-cream rounded-2xl border-[3px] border-plum p-4 text-sm'>
        <p className='font-bold'>Générer un secret :</p>
        <code className='block font-mono text-xs mt-2 break-all text-fooder-secondary'>node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64url&apos;))&quot;</code>
        <p className='mt-3 text-cream/75'>Pas à pas complet : docs/BACKOFFICE.md.</p>
      </div>
    </div>
  );
}
