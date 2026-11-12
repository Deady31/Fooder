import { NextRequest, NextResponse } from 'next/server';
import records from '../../../../data/toulouse-places.json';
import { ADMIN_COOKIE, isAdminToken, readAdminConfig } from '../../../../lib/admin/auth';
import { DEFAULT_FUNNEL, FunnelRaw, RetentionRaw, isUuid, parseDays, parseSteps } from '../../../../lib/admin/metrics';
import { RpcError, rpc } from '../../../../lib/admin/rpc';
import type { DailyRow, EventNameRow, MetricsPayload, Overview, RecentUser, RestoRow, ScreenRow, TimelineRow, UserInfo, UserPayload } from '../../../../lib/admin/types';
import type { OsmRecord } from '../../../../lib/osm';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const PLACES = records as OsmRecord[];
let nameIndex: Map<string, string> | null = null;

function restoName(id: string): string | null {
  if (!nameIndex) nameIndex = new Map(PLACES.map(r => [r.id, r.n]));
  return nameIndex.get(id) ?? null;
}

const fail = (error: string, message: string, status: number) => NextResponse.json({ error, message }, { status, headers: NO_STORE });

async function dashboard(days: number, steps: string[]): Promise<MetricsPayload> {
  const [overview, daily, funnel, retention, screens, restos, events, recentUsers] = await Promise.all([
    rpc<Overview>('admin_overview', { p_days: days }),
    rpc<DailyRow[]>('admin_daily', { p_days: days }),
    rpc<FunnelRaw[]>('admin_funnel', { p_steps: steps, p_days: days }),
    rpc<RetentionRaw[]>('admin_retention', { p_days: days, p_grain: days > 30 ? 'week' : 'day' }),
    rpc<ScreenRow[]>('admin_top_screens', { p_days: days, p_limit: 12 }),
    rpc<Omit<RestoRow, 'name'>[]>('admin_top_restos', { p_days: days, p_limit: 12 }),
    rpc<EventNameRow[]>('admin_event_names', { p_days: days }),
    rpc<RecentUser[]>('admin_recent_users', { p_limit: 15 }),
  ]);
  return {
    days,
    generatedAt: new Date().toISOString(),
    steps,
    overview,
    daily,
    funnel,
    retention,
    screens,
    restos: restos.map(r => ({ ...r, name: restoName(r.rest_id) })),
    events,
    recentUsers,
  };
}

async function userJourney(user: string): Promise<UserPayload> {
  const [info, timeline] = await Promise.all([
    rpc<UserInfo>('admin_user_info', { p_user: user }),
    rpc<TimelineRow[]>('admin_user_timeline', { p_user: user, p_limit: 300 }),
  ]);
  const restoNames: Record<string, string> = {};
  for (const row of timeline) {
    const n = row.rest_id ? restoName(row.rest_id) : null;
    if (row.rest_id && n) restoNames[row.rest_id] = n;
  }
  return { info, timeline, restoNames };
}

export async function GET(req: NextRequest) {
  if (!readAdminConfig().ok) return fail('config', 'Backoffice non configuré.', 503);
  if (!isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return fail('unauthorized', 'Session expirée, reconnecte-toi.', 401);

  const q = req.nextUrl.searchParams;
  try {
    const user = q.get('user');
    if (user !== null) {
      if (!isUuid(user.trim())) return fail('bad_request', 'Identifiant utilisateur invalide (format UUID attendu).', 400);
      return NextResponse.json(await userJourney(user.trim().toLowerCase()), { headers: NO_STORE });
    }
    const stepsParam = q.get('steps');
    const steps = stepsParam ? parseSteps(stepsParam) : DEFAULT_FUNNEL;
    if (!steps) return fail('bad_request', 'Étapes du funnel invalides : 2 à 8 noms (minuscules, chiffres, _), séparés par des virgules.', 400);
    return NextResponse.json(await dashboard(parseDays(q.get('days')), steps), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof RpcError) {
      if (e.kind === 'missing_migration') return fail('missing_migration', 'Pas encore de données : joue la migration 20261113000000_tracking.sql dans Supabase.', 424);
      if (e.kind === 'config') return fail('config', e.message, 503);
      return fail('upstream', e.message, 502);
    }
    return fail('upstream', 'Erreur inattendue côté serveur.', 500);
  }
}
