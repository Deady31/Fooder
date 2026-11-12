import type { EnsureResult } from './session';
import { ensureCloudSession } from './session';

/**
 * Exécute une action cloud demandée explicitement par l'utilisateur, après avoir obtenu une session (anonyme si besoin).
 * Jamais d'exception : en cas d'échec (cloud absent, connexions anonymes désactivées, réseau, quota), l'appelant
 * garde ses données locales et affiche `message`. `silent` = cloud non configuré (mode local normal, rien à dire).
 */
export interface GateResult<T> {
  ok: boolean;
  value?: T;
  silent?: boolean;
  message?: string;
}

export const LOCAL_FALLBACK_MESSAGE = 'Enregistré sur ce téléphone, pas encore en ligne. Tu pourras réessayer plus tard.';

export async function runWithSession<T>(
  action: (uid: string) => Promise<T>,
  ensure: () => Promise<EnsureResult> = ensureCloudSession
): Promise<GateResult<T>> {
  let session: EnsureResult;
  try {
    session = await ensure();
  } catch {
    return { ok: false, message: LOCAL_FALLBACK_MESSAGE };
  }
  if (!session.ok || !session.uid) {
    if (session.reason === 'cloud_off') return { ok: false, silent: true };
    return { ok: false, message: session.message ?? LOCAL_FALLBACK_MESSAGE };
  }
  try {
    return { ok: true, value: await action(session.uid) };
  } catch {
    return { ok: false, message: LOCAL_FALLBACK_MESSAGE };
  }
}
