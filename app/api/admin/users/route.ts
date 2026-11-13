import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminToken, readAdminConfig } from '../../../../lib/admin/auth';
import { RpcError, rpc } from '../../../../lib/admin/rpc';
import { PAGE_SIZE, UsersResponse, normalizeDevices, normalizeUsers, parseUsersQuery } from '../../../../lib/admin/users';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const MIGRATION = '20261115000000_admin_users.sql';

const fail = (error: string, message: string, status: number) => NextResponse.json({ error, message }, { status, headers: NO_STORE });

export async function GET(req: NextRequest) {
  if (!readAdminConfig().ok) return fail('config', 'Backoffice non configuré.', 503);
  if (!isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return fail('unauthorized', 'Session expirée, reconnecte-toi.', 401);

  const { page, q, days } = parseUsersQuery(req.nextUrl.searchParams);
  try {
    const [users, devices] = await Promise.all([
      rpc<unknown>('admin_users', { lim: PAGE_SIZE, off: (page - 1) * PAGE_SIZE, q: q || null }),
      rpc<unknown>('admin_devices', { days }),
    ]);
    const body: UsersResponse = { page, q, days, users: normalizeUsers(users), devices: normalizeDevices(devices) };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof RpcError) {
      if (e.kind === 'missing_migration') return fail('missing_migration', `Pas encore de données : joue la migration ${MIGRATION} dans Supabase.`, 424);
      if (e.kind === 'config') return fail('config', e.message, 503);
      return fail('upstream', e.message, 502);
    }
    return fail('upstream', 'Erreur inattendue côté serveur.', 500);
  }
}
