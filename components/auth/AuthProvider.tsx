'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { cloud, isCloudEnabled } from '../../lib/cloud/client';
import { startSync, pushNow } from '../../lib/cloud/sync';
import { refreshFriends, reattachLocalFriends } from '../../lib/cloud/social';
import { AuthFailure, EnsureResult, FAILURE_MESSAGE, authMessage, classifyAuthError, ensureCloudSession } from '../../lib/cloud/session';
import { flushUsage, track } from '../../lib/analytics';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

/** Résultat d'une action de connexion : jamais d'exception, un message lisible en cas d'échec. */
export interface AuthResult {
  ok: boolean;
  reason?: AuthFailure;
  message?: string;
}

interface AuthState {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  uid: string | null;
  email: string | null;
  /** Compte anonyme (créé sans formulaire) : pas encore sauvegardé par e-mail. */
  anonymous: boolean;
  sync: SyncStatus;
  /**
   * Crée ou réutilise une session cloud (compte anonyme si besoin). À appeler au premier besoin cloud : ami, groupe, photo.
   * captchaToken : obligatoire dès que le captcha Supabase est activé (Turnstile / hCaptcha).
   */
  ensureSession: (opts?: { captchaToken?: string }) => Promise<EnsureResult>;
  /** Connexion à un compte existant (ou création) : envoie le lien + code par e-mail. captchaToken : idem ensureSession. */
  sendCode: (email: string, captchaToken?: string) => Promise<AuthResult>;
  verifyCode: (email: string, code: string) => Promise<AuthResult>;
  /** « Sauvegarde ton compte » : rattache un e-mail au compte anonyme courant (même identifiant, données conservées). */
  sendUpgradeCode: (email: string) => Promise<AuthResult>;
  verifyUpgradeCode: (email: string, code: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const NEW_ACCOUNT_WINDOW_MS = 2 * 60_000;

const OK: AuthResult = { ok: true };
const fail = (reason: AuthFailure, message = FAILURE_MESSAGE[reason]): AuthResult => ({ ok: false, reason, message });
const cloudOff = (): AuthResult => fail('cloud_off');

function parseCode(code: string): string | null {
  const token = code.replace(/\D/g, '');
  return token.length >= 6 && token.length <= 8 ? token : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = isCloudEnabled();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [sync, setSync] = useState<SyncStatus>('off');

  useEffect(() => {
    const sb = cloud();
    if (!sb) return;
    let cancelled = false;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .catch(() => {
        /* lecture de session impossible : on reste déconnecté */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const uid = session?.user.id ?? null;
  const anonymous = session?.user.is_anonymous === true;

  // Synchronisation automatique tant que la session est ouverte
  useEffect(() => {
    if (!uid) {
      setSync('off');
      return;
    }
    setSync('syncing');
    const stop = startSync(uid, () => setSync('error'));
    refreshFriends(uid)
      .then(() => setSync(s => (s === 'error' ? s : 'ok')))
      .catch(() => setSync('error'));
    flushUsage();
    return stop;
  }, [uid]);

  const ensureSession = useCallback((opts?: { captchaToken?: string }) => ensureCloudSession(opts), []);

  const sendCode = useCallback(async (email: string, captchaToken?: string): Promise<AuthResult> => {
    const sb = cloud();
    if (!sb) return cloudOff();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return fail('email_invalid');
    const { error } = await sb.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/compte`, ...(captchaToken ? { captchaToken } : {}) },
    });
    if (error) return fail(classifyAuthError(error), authMessage(error));
    track('auth_code_sent');
    return OK;
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string): Promise<AuthResult> => {
      const sb = cloud();
      if (!sb) return cloudOff();
      const token = parseCode(code);
      if (!token) return fail('code_invalid', 'Le code contient 6 chiffres.');
      const previousUid = uid;
      const wasAnonymous = anonymous;
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
      if (error) return fail(classifyAuthError(error), authMessage(error));
      track('auth_signed_in');
      const user = data.user;
      if (user && Date.now() - Date.parse(user.created_at) < NEW_ACCOUNT_WINDOW_MS) track('signup', { method: 'otp' });
      // Compte anonyme → compte existant : les données locales sont fusionnées par la synchro (lib/cloud/merge.ts) ;
      // on recrée en plus côté serveur les amitiés de l'appareil, restées sur l'ancien compte anonyme.
      if (wasAnonymous && user && user.id !== previousUid) {
        reattachLocalFriends()
          .then(() => refreshFriends(user.id))
          .catch(() => undefined);
      }
      return OK;
    },
    [uid, anonymous]
  );

  const sendUpgradeCode = useCallback(async (email: string): Promise<AuthResult> => {
    const sb = cloud();
    if (!sb) return cloudOff();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return fail('email_invalid');
    const { error } = await sb.auth.updateUser({ email: clean }, { emailRedirectTo: `${window.location.origin}/compte` });
    if (error) return fail(classifyAuthError(error), authMessage(error));
    return OK;
  }, []);

  const verifyUpgradeCode = useCallback(async (email: string, code: string): Promise<AuthResult> => {
    const sb = cloud();
    if (!sb) return cloudOff();
    const token = parseCode(code);
    if (!token) return fail('code_invalid', 'Le code contient 6 chiffres.');
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email_change' });
    if (error) return fail(classifyAuthError(error), authMessage(error));
    // Le jeton doit être renouvelé pour que le claim is_anonymous passe à false
    await sb.auth.refreshSession().catch(() => undefined);
    track('signup', { method: 'upgrade' });
    return OK;
  }, []);

  const signOut = useCallback(async () => {
    const sb = cloud();
    if (!sb) return;
    if (uid) await pushNow(uid).catch(() => undefined);
    await sb.auth.signOut();
  }, [uid]);

  const syncNow = useCallback(async () => {
    if (!uid) return;
    setSync('syncing');
    const ok = await pushNow(uid).catch(() => false);
    await refreshFriends(uid).catch(() => 0);
    setSync(ok ? 'ok' : 'error');
  }, [uid]);

  const value = useMemo<AuthState>(
    () => ({
      enabled,
      loading,
      session,
      uid,
      email: session?.user.email ?? null,
      anonymous,
      sync,
      ensureSession,
      sendCode,
      verifyCode,
      sendUpgradeCode,
      verifyUpgradeCode,
      signOut,
      syncNow,
    }),
    [enabled, loading, session, uid, anonymous, sync, ensureSession, sendCode, verifyCode, sendUpgradeCode, verifyUpgradeCode, signOut, syncNow]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const OFF: AuthState = {
  enabled: false,
  loading: false,
  session: null,
  uid: null,
  email: null,
  anonymous: false,
  sync: 'off',
  ensureSession: async () => ({ ok: false, reason: 'cloud_off', message: FAILURE_MESSAGE.cloud_off }),
  sendCode: async () => cloudOff(),
  verifyCode: async () => cloudOff(),
  sendUpgradeCode: async () => cloudOff(),
  verifyUpgradeCode: async () => cloudOff(),
  signOut: async () => undefined,
  syncNow: async () => undefined,
};

export function useAuth(): AuthState {
  return useContext(AuthContext) ?? OFF;
}
