import { describe, expect, it } from 'vitest';
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  checkPasscode,
  createLoginLimiter,
  readAdminConfig,
  signSession,
  verifySession,
} from '../lib/admin/auth';

const SECRET = 'un-secret-de-test-assez-long-pour-hmac-0123456789';
const T0 = Date.parse('2026-11-13T10:00:00Z');

describe('mot de passe administrateur', () => {
  it('accepte le bon code', () => {
    expect(checkPasscode('Fooder-2026!', 'Fooder-2026!')).toBe(true);
  });
  it('refuse un code faux, vide, de longueur différente ou non texte', () => {
    expect(checkPasscode('fooder-2026!', 'Fooder-2026!')).toBe(false);
    expect(checkPasscode('Fooder-2026', 'Fooder-2026!')).toBe(false);
    expect(checkPasscode('', 'Fooder-2026!')).toBe(false);
    expect(checkPasscode(undefined, 'Fooder-2026!')).toBe(false);
    expect(checkPasscode(12345, '12345')).toBe(false);
  });
  it('refuse tout si aucun code n’est configuré', () => {
    expect(checkPasscode('', '')).toBe(false);
    expect(checkPasscode('x', undefined)).toBe(false);
  });
});

describe('cookie de session signé (HMAC)', () => {
  it('un jeton signé est valide jusqu’à son expiration (12 h)', () => {
    const token = signSession(SECRET, T0);
    expect(verifySession(token, SECRET, T0 + 1000)).toBe(true);
    expect(verifySession(token, SECRET, T0 + SESSION_TTL_MS - 1)).toBe(true);
    expect(verifySession(token, SECRET, T0 + SESSION_TTL_MS + 1)).toBe(false);
  });
  it('refuse un jeton altéré ou signé avec un autre secret', () => {
    const token = signSession(SECRET, T0);
    const [v, exp, nonce, sig] = token.split('.');
    expect(verifySession(`${v}.${Number(exp) + 999999}.${nonce}.${sig}`, SECRET, T0)).toBe(false);
    expect(verifySession(`${v}.${exp}.${nonce}.${sig.slice(0, -2)}AA`, SECRET, T0)).toBe(false);
    expect(verifySession(token, SECRET + 'x', T0)).toBe(false);
  });
  it('refuse les formes invalides', () => {
    expect(verifySession(undefined, SECRET, T0)).toBe(false);
    expect(verifySession('', SECRET, T0)).toBe(false);
    expect(verifySession('a.b.c', SECRET, T0)).toBe(false);
    expect(verifySession('v1.abc.def.ghi', SECRET, T0)).toBe(false);
  });
  it('refuse tout sans secret', () => {
    const token = signSession(SECRET, T0);
    expect(verifySession(token, '', T0)).toBe(false);
  });
  it('deux jetons successifs sont différents', () => {
    expect(signSession(SECRET, T0)).not.toBe(signSession(SECRET, T0));
  });
  it('nom de cookie stable', () => {
    expect(ADMIN_COOKIE).toBe('fooder_admin');
  });
});

describe('configuration', () => {
  const full = {
    ADMIN_PASSCODE: 'un-code-solide',
    ADMIN_SESSION_SECRET: SECRET,
    SUPABASE_SERVICE_ROLE_KEY: 'cle-service-factice-pour-test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
  };
  it('complète', () => {
    expect(readAdminConfig(full)).toMatchObject({ ok: true, missing: [] });
  });
  it('liste les variables manquantes', () => {
    const r = readAdminConfig({ ...full, ADMIN_PASSCODE: '', SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(['ADMIN_PASSCODE', 'SUPABASE_SERVICE_ROLE_KEY']));
  });
  it('secret trop court : signalé comme manquant', () => {
    const r = readAdminConfig({ ...full, ADMIN_SESSION_SECRET: 'court' });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('ADMIN_SESSION_SECRET');
  });
  it('accepte SUPABASE_URL en secours', () => {
    const r = readAdminConfig({ ...full, NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_URL: 'https://abcd.supabase.co' });
    expect(r.ok).toBe(true);
    expect(r.supabaseUrl).toBe('https://abcd.supabase.co');
  });
});

describe('limitation des tentatives', () => {
  it('bloque après N essais dans la fenêtre puis libère', () => {
    const lim = createLoginLimiter(3, 60_000);
    expect(lim.hit('ip', T0)).toBe(true);
    expect(lim.hit('ip', T0 + 1)).toBe(true);
    expect(lim.hit('ip', T0 + 2)).toBe(true);
    expect(lim.hit('ip', T0 + 3)).toBe(false);
    expect(lim.hit('autre', T0 + 3)).toBe(true);
    expect(lim.hit('ip', T0 + 60_001)).toBe(true);
  });
  it('reset après une connexion réussie', () => {
    const lim = createLoginLimiter(1, 60_000);
    lim.hit('ip', T0);
    lim.reset('ip');
    expect(lim.hit('ip', T0)).toBe(true);
  });
});
