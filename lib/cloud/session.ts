import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { cloud } from './client';

/**
 * Session cloud à la demande : un compte anonyme est créé au premier besoin (ami, groupe, photo),
 * sans formulaire. Plus tard l'utilisateur peut le convertir en compte e-mail (même identifiant, mêmes données).
 */

export type AuthFailure =
  | 'cloud_off'
  | 'anon_disabled'
  | 'captcha'
  | 'rate_limit'
  | 'email_exists'
  | 'code_invalid'
  | 'signups_closed'
  | 'email_invalid'
  | 'network'
  | 'unknown';

export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Classe une erreur d'authentification Supabase (le code est prioritaire, le message sert de secours). */
export function classifyAuthError(e: AuthErrorLike | null | undefined): AuthFailure {
  if (!e) return 'unknown';
  const code = (e.code ?? '').toLowerCase();
  const msg = (e.message ?? '').toLowerCase();
  if (code === 'anonymous_provider_disabled' || /anonymous sign-?ins? (are|is) disabled/.test(msg)) return 'anon_disabled';
  if (code === 'captcha_failed' || /captcha/.test(msg)) return 'captcha';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || e.status === 429 || /rate limit|too many|security purposes/.test(msg)) return 'rate_limit';
  if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists' || /already (been )?registered|already exists/.test(msg)) return 'email_exists';
  if (code === 'email_address_invalid' || code === 'validation_failed' || /email address .*invalid/.test(msg)) return 'email_invalid';
  if (code === 'otp_expired' || code === 'otp_disabled' || /token has expired|invalid (otp|token|code)|otp (has )?(expired|is invalid)|(link|code|otp|token) (is )?invalid or (has )?expired/.test(msg)) return 'code_invalid';
  if (code === 'signup_disabled' || /signups? not allowed|signups? (are )?disabled/.test(msg)) return 'signups_closed';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /failed to fetch|network|fetch failed/.test(msg)) return 'network';
  return 'unknown';
}

export const FAILURE_MESSAGE: Record<AuthFailure, string> = {
  cloud_off: 'Comptes indisponibles pour le moment.',
  anon_disabled: 'La sauvegarde en ligne n’est pas disponible pour l’instant. Tout reste sur ce téléphone.',
  captcha: 'Vérification de sécurité refusée. Réessaie dans un instant.',
  rate_limit: 'Trop de tentatives, réessaie dans une minute.',
  email_exists: 'Cette adresse a déjà un compte.',
  code_invalid: 'Code incorrect ou expiré. Demande un nouveau code.',
  signups_closed: 'Les inscriptions sont fermées pour le moment.',
  email_invalid: 'Adresse e-mail invalide.',
  network: 'Pas de connexion. Réessaie quand tu as du réseau.',
  unknown: 'Connexion impossible pour le moment. Réessaie.',
};

export const authMessage = (e: AuthErrorLike | null | undefined): string => FAILURE_MESSAGE[classifyAuthError(e)];

/**
 * Résultat à plat (le projet n'est pas en mode strict : un type union ne se réduirait pas sur `ok`).
 * ok = true : uid, anonymous et session sont renseignés. ok = false : reason et message (en français) le sont.
 */
export interface EnsureResult {
  ok: boolean;
  uid?: string;
  anonymous?: boolean;
  session?: Session;
  reason?: AuthFailure;
  message?: string;
}

type AuthClient = Pick<SupabaseClient['auth'], 'getSession' | 'signInAnonymously'>;

/**
 * Fabrique la fonction ensureSession (client injecté pour les tests).
 * - une session existante est réutilisée ;
 * - les appels simultanés partagent une seule création ;
 * - si les connexions anonymes sont désactivées côté Supabase (ou captcha exigé), on le retient pour cette visite
 *   et on laisse l'appli en mode local, sans réessayer à chaque action.
 */
export function createSessionEnsurer(getClient: () => { auth: AuthClient } | null) {
  let inflight: Promise<EnsureResult> | null = null;
  let blocked: EnsureResult | null = null;

  const fail = (reason: AuthFailure): EnsureResult => ({ ok: false, reason, message: FAILURE_MESSAGE[reason] });
  const okResult = (session: Session): EnsureResult => ({ ok: true, uid: session.user.id, anonymous: session.user.is_anonymous === true, session });

  return async function ensureSession(opts?: { captchaToken?: string }): Promise<EnsureResult> {
    const sb = getClient();
    if (!sb) return fail('cloud_off');
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) return okResult(data.session);
    } catch {
      return fail('network');
    }
    if (blocked) return blocked;
    if (!inflight) {
      inflight = (async (): Promise<EnsureResult> => {
        try {
          const { data, error } = await sb.auth.signInAnonymously(opts?.captchaToken ? { options: { captchaToken: opts.captchaToken } } : undefined);
          if (error || !data.session) {
            const reason = classifyAuthError(error);
            const result = fail(reason);
            if (reason === 'anon_disabled' || reason === 'signups_closed') blocked = result;
            return result;
          }
          return okResult(data.session);
        } catch (e) {
          return fail(classifyAuthError(e as AuthErrorLike));
        }
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}

/** Crée (ou réutilise) la session cloud. À appeler au premier besoin cloud : ami, groupe, photo. */
export const ensureCloudSession = createSessionEnsurer(cloud);
