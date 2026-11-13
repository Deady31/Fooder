/** Acceptation des conditions d'utilisation : fonctions pures (le stockage est dans lib/profile.ts). */

/** Version des conditions et de la politique de confidentialité (AAAA-MM-JJ). À changer à chaque modification de fond. */
export const TERMS_VERSION = '2026-11-13';

/** Repli local pour un utilisateur déjà inscrit mais sans profil enregistré (très anciens comptes). */
export const TERMS_FALLBACK_KEY = 'fooder_terms_accepted';

export interface TermsAcceptance {
  /** Date d'acceptation, ISO 8601 */
  termsAcceptedAt: string;
  /** Version acceptée (AAAA-MM-JJ) */
  termsVersion: string;
}

const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTermsVersion(v: unknown): v is string {
  return typeof v === 'string' && VERSION_PATTERN.test(v);
}

/** Acceptation valide (date lisible + version bien formée) extraite d'un objet quelconque ; null sinon. */
export function sanitizeTermsAcceptance(raw: unknown): TermsAcceptance | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { termsAcceptedAt, termsVersion } = raw as Record<string, unknown>;
  if (typeof termsAcceptedAt !== 'string' || Number.isNaN(Date.parse(termsAcceptedAt))) return null;
  if (!isValidTermsVersion(termsVersion)) return null;
  return { termsAcceptedAt, termsVersion };
}

export function createAcceptance(now: number = Date.now(), version: string = TERMS_VERSION): TermsAcceptance {
  return { termsAcceptedAt: new Date(now).toISOString(), termsVersion: version };
}

/** Vrai s'il n'y a aucune acceptation valide ou si la version acceptée est plus ancienne que la version courante. */
export function needsTermsAcceptance(acceptance: unknown, current: string = TERMS_VERSION): boolean {
  const ok = sanitizeTermsAcceptance(acceptance);
  return ok === null || ok.termsVersion < current;
}

/** Les pages légales restent toujours lisibles, même sans avoir accepté. */
export function isLegalPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && (pathname === '/legal' || pathname.startsWith('/legal/'));
}

/** « C'est parti » et « Passer » exigent la case cochée. */
export function canFinishOnboarding(termsChecked: boolean): boolean {
  return termsChecked === true;
}

/** Fenêtre d'acceptation : utilisateur inscrit, version à jour manquante, et pas sur une page légale. */
export function shouldShowTermsGate(input: { pathname: string | null | undefined; onboardingDone: boolean; acceptance: unknown; current?: string }): boolean {
  if (!input.onboardingDone || isLegalPath(input.pathname)) return false;
  return needsTermsAcceptance(input.acceptance, input.current);
}
