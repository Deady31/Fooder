import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { classifyAuthError, authMessage, createSessionEnsurer, FAILURE_MESSAGE } from '../lib/cloud/session';
import { isCloudEnabled } from '../lib/cloud/client';
import { track, getUsageEnabled } from '../lib/analytics';

const fakeSession = (anonymous: boolean): Session =>
  ({ user: { id: 'u-1', is_anonymous: anonymous }, access_token: 't', refresh_token: 'r', expires_in: 3600, token_type: 'bearer' }) as unknown as Session;

function fakeClient(opts: { existing?: Session | null; signIn?: () => Promise<{ data: { session: Session | null }; error: unknown }> }) {
  const signInAnonymously = vi.fn(opts.signIn ?? (async () => ({ data: { session: fakeSession(true) }, error: null })));
  const getSession = vi.fn(async () => ({ data: { session: opts.existing ?? null }, error: null }));
  return { client: { auth: { getSession, signInAnonymously } } as never, signInAnonymously, getSession };
}

describe('classification des erreurs d’authentification', () => {
  it('reconnaît les connexions anonymes désactivées', () => {
    expect(classifyAuthError({ code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled', status: 422 })).toBe('anon_disabled');
    expect(classifyAuthError({ message: 'Anonymous sign-ins are disabled' })).toBe('anon_disabled');
  });

  it('reconnaît captcha, limite de débit, e-mail déjà pris, code invalide, réseau', () => {
    expect(classifyAuthError({ code: 'captcha_failed' })).toBe('captcha');
    expect(classifyAuthError({ code: 'over_email_send_rate_limit', status: 429 })).toBe('rate_limit');
    expect(classifyAuthError({ message: 'For security purposes, you can only request this after 59 seconds.' })).toBe('rate_limit');
    expect(classifyAuthError({ code: 'email_exists', status: 422 })).toBe('email_exists');
    expect(classifyAuthError({ message: 'A user with this email address has already been registered' })).toBe('email_exists');
    expect(classifyAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe('code_invalid');
    expect(classifyAuthError({ message: 'Signups not allowed for otp' })).toBe('signups_closed');
    expect(classifyAuthError({ code: 'email_address_invalid', message: 'Email address "x" is invalid' })).toBe('email_invalid');
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toBe('network');
    expect(classifyAuthError({ message: 'boom' })).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
  });

  it('ne classe en code_invalid que les vrais messages de code OTP', () => {
    expect(classifyAuthError({ message: 'Token has expired or is invalid' })).toBe('code_invalid');
    expect(classifyAuthError({ message: 'Invalid token' })).toBe('code_invalid');
    expect(classifyAuthError({ message: 'Email link is invalid or has expired' })).toBe('code_invalid');
    expect(classifyAuthError({ code: 'otp_expired' })).toBe('code_invalid');
    expect(classifyAuthError({ message: 'Invalid login credentials' })).toBe('unknown');
    expect(classifyAuthError({ message: 'invalid input syntax for type uuid' })).toBe('unknown');
    expect(classifyAuthError({ message: 'JWT expired' })).toBe('unknown');
  });

  it('donne un message en français pour chaque cas, sans détail technique', () => {
    for (const msg of Object.values(FAILURE_MESSAGE)) expect(msg.length).toBeGreaterThan(10);
    expect(authMessage({ code: 'anonymous_provider_disabled' })).toContain('ce téléphone');
  });
});

describe('ensureSession (compte anonyme à la demande)', () => {
  it('réutilise une session existante sans en créer', async () => {
    const { client, signInAnonymously } = fakeClient({ existing: fakeSession(false) });
    const res = await createSessionEnsurer(() => client)();
    expect(res).toMatchObject({ ok: true, uid: 'u-1', anonymous: false });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('crée un compte anonyme s’il n’y a pas de session', async () => {
    const { client, signInAnonymously } = fakeClient({});
    const res = await createSessionEnsurer(() => client)();
    expect(res).toMatchObject({ ok: true, anonymous: true });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('partage une seule création entre appels simultanés', async () => {
    const { client, signInAnonymously } = fakeClient({});
    const ensure = createSessionEnsurer(() => client);
    const all = await Promise.all([ensure(), ensure(), ensure()]);
    expect(all.every(r => r.ok)).toBe(true);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('retombe en local sans réessayer quand les connexions anonymes sont désactivées', async () => {
    const { client, signInAnonymously } = fakeClient({
      signIn: async () => ({ data: { session: null }, error: { code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled', status: 422 } }),
    });
    const ensure = createSessionEnsurer(() => client);
    const first = await ensure();
    const second = await ensure();
    expect(first).toMatchObject({ ok: false, reason: 'anon_disabled' });
    expect(second).toMatchObject({ ok: false, reason: 'anon_disabled' });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('réessaie après une panne réseau (pas de blocage définitif)', async () => {
    let n = 0;
    const { client, signInAnonymously } = fakeClient({
      signIn: async () => (n++ === 0 ? { data: { session: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } } : { data: { session: fakeSession(true) }, error: null }),
    });
    const ensure = createSessionEnsurer(() => client);
    expect(await ensure()).toMatchObject({ ok: false, reason: 'network' });
    expect(await ensure()).toMatchObject({ ok: true });
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('transmet le jeton captcha', async () => {
    const { client, signInAnonymously } = fakeClient({});
    await createSessionEnsurer(() => client)({ captchaToken: 'tok' });
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'tok' } });
  });

  it('transforme une exception en échec propre', async () => {
    const { client } = fakeClient({
      signIn: async () => {
        throw new Error('crash');
      },
    });
    expect(await createSessionEnsurer(() => client)()).toMatchObject({ ok: false });
  });

  it('renvoie cloud_off sans client (appli 100 % locale)', async () => {
    expect(await createSessionEnsurer(() => null)()).toMatchObject({ ok: false, reason: 'cloud_off' });
  });
});

describe('mode 100 % local sans variables Supabase', () => {
  it('le cloud est désactivé dans les tests', () => {
    expect(isCloudEnabled()).toBe(false);
  });

  it('track() est un no-op total côté serveur (pas de fenêtre ni de réseau)', () => {
    expect(() => track('swipe_like', { cuisine: 'pizza' })).not.toThrow();
    expect(getUsageEnabled()).toBe(true);
  });
});
