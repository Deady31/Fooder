import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, SESSION_TTL_MS, checkPasscode, createLoginLimiter, readAdminConfig, signSession } from '../../../../lib/admin/auth';

export const dynamic = 'force-dynamic';

const limiter = createLoginLimiter(8, 15 * 60_000);
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

const clientKey = (req: NextRequest): string => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.ip || 'local';

export async function POST(req: NextRequest) {
  const cfg = readAdminConfig();
  if (!cfg.ok) return NextResponse.json({ error: 'config', message: 'Backoffice non configuré.' }, { status: 503, headers: NO_STORE });

  const key = clientKey(req);
  if (!limiter.hit(key, Date.now())) {
    return NextResponse.json({ error: 'rate_limited', message: 'Trop de tentatives. Réessaie dans 15 minutes.' }, { status: 429, headers: NO_STORE });
  }

  let passcode: unknown = null;
  try {
    passcode = ((await req.json()) as { passcode?: unknown }).passcode;
  } catch {
    passcode = null;
  }

  if (!checkPasscode(passcode, process.env.ADMIN_PASSCODE)) {
    await new Promise(r => setTimeout(r, 400)); // ralentit les essais en série
    return NextResponse.json({ error: 'unauthorized', message: 'Mot de passe incorrect.' }, { status: 401, headers: NO_STORE });
  }

  limiter.reset(key);
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(ADMIN_COOKIE, signSession(process.env.ADMIN_SESSION_SECRET as string, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
