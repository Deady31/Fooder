'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { cloud, isCloudEnabled } from '../../lib/cloud/client';
import { startSync, pushNow } from '../../lib/cloud/sync';
import { refreshFriends } from '../../lib/cloud/social';
import { track } from '../../lib/analytics';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

interface AuthState {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  uid: string | null;
  email: string | null;
  sync: SyncStatus;
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** Message lisible pour les erreurs d'authentification (sans détail technique). */
function friendlyError(message: string): string {
  if (/rate|too many|security purposes/i.test(message)) return 'Trop de tentatives, réessaie dans une minute.';
  if (/expired|invalid|token/i.test(message)) return 'Code invalide ou expiré. Demande un nouveau code.';
  if (/signups not allowed/i.test(message)) return 'Les inscriptions sont fermées pour le moment.';
  return 'Connexion impossible pour le moment. Réessaie.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = isCloudEnabled();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [sync, setSync] = useState<SyncStatus>('off');

  useEffect(() => {
    const sb = cloud();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id ?? null;

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
    return stop;
  }, [uid]);

  const sendCode = useCallback(async (email: string): Promise<string | null> => {
    const sb = cloud();
    if (!sb) return 'Comptes indisponibles.';
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return 'Adresse e-mail invalide.';
    const { error } = await sb.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/compte` },
    });
    if (error) return friendlyError(error.message);
    track('auth_code_sent');
    return null;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<string | null> => {
    const sb = cloud();
    if (!sb) return 'Comptes indisponibles.';
    const token = code.replace(/\D/g, '');
    if (token.length < 6 || token.length > 8) return 'Le code contient 6 chiffres.';
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    if (error) return friendlyError(error.message);
    track('auth_signed_in');
    return null;
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
    () => ({ enabled, loading, session, uid, email: session?.user.email ?? null, sync, sendCode, verifyCode, signOut, syncNow }),
    [enabled, loading, session, uid, sync, sendCode, verifyCode, signOut, syncNow]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const OFF: AuthState = {
  enabled: false,
  loading: false,
  session: null,
  uid: null,
  email: null,
  sync: 'off',
  sendCode: async () => 'Comptes indisponibles.',
  verifyCode: async () => 'Comptes indisponibles.',
  signOut: async () => undefined,
  syncNow: async () => undefined,
};

export function useAuth(): AuthState {
  return useContext(AuthContext) ?? OFF;
}
