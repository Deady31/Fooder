import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminToken, readAdminConfig } from '../../lib/admin/auth';
import { AdminLogin } from '../../components/admin/AdminLogin';
import { AdminSetup } from '../../components/admin/AdminSetup';
import { Dashboard } from '../../components/admin/Dashboard';

// Backoffice : non indexé, non lié depuis l'appli, rendu à chaque requête (cookie de session).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Backoffice · Fooder',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminPage() {
  const cfg = readAdminConfig();
  const authed = cfg.ok && isAdminToken(cookies().get(ADMIN_COOKIE)?.value);

  return (
    // L'appli bloque le défilement du body : le backoffice a son propre conteneur défilant, texte sélectionnable.
    <main className='h-full overflow-y-auto scroll-y select-text bg-cream'>
      {!cfg.ok ? <AdminSetup missing={cfg.missing} /> : authed ? <Dashboard /> : <AdminLogin />}
    </main>
  );
}
