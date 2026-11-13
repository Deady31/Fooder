/** Décision d'afficher l'invitation à installer : fonctions pures, environnement injecté. */

export const DISMISS_KEY = 'fooder_install_dismissed';
export const DISMISS_MS = 7 * 24 * 3600 * 1000;

export interface UaEnv {
  ua: string;
  platform?: string;
  maxTouchPoints?: number;
}

export type InstallMode = 'hidden' | 'android' | 'ios';

/** iPhone, iPod, iPad (iPadOS se présente comme un Mac tactile). */
export function isIos({ ua, platform, maxTouchPoints }: UaEnv): boolean {
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return platform === 'MacIntel' && (maxTouchPoints ?? 0) > 1;
}

/** Safari iOS « pur » : seul navigateur où le menu Partager propose l'écran d'accueil de façon fiable. */
export function isIosSafari(env: UaEnv): boolean {
  return isIos(env) && !/crios|fxios|edgios|opios|fban|fbav|instagram|line\/|gsa\/|twitter/i.test(env.ua);
}

export function isStandalone(env: { displayModeStandalone?: boolean; navigatorStandalone?: boolean }): boolean {
  return env.displayModeStandalone === true || env.navigatorStandalone === true;
}

/** Refus encore valable (moins de 7 jours) ; une date invalide ou future est ignorée. */
export function isDismissed(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null || !Number.isFinite(dismissedAt)) return false;
  const age = now - dismissedAt;
  return age >= 0 && age < DISMISS_MS;
}

export function decideInstall(input: {
  standalone: boolean;
  iosSafari: boolean;
  hasPrompt: boolean;
  dismissedAt: number | null;
  now: number;
}): InstallMode {
  if (input.standalone || isDismissed(input.dismissedAt, input.now)) return 'hidden';
  if (input.hasPrompt) return 'android';
  if (input.iosSafari) return 'ios';
  return 'hidden';
}

/* ── Étape « écran d'accueil » de l'inscription ──────────────────── */

export type OnboardingInstallMode = 'skip' | 'native' | 'ios' | 'inapp';

/** Navigateur intégré à une application (Instagram, TikTok, Facebook, Snapchat, WebView Android…) : installation impossible. */
export function isInAppBrowser(ua: string): boolean {
  return /instagram|fban|fbav|fb_iab|tiktok|musical_ly|bytedancewebview|snapchat|linkedinapp|micromessenger|twitter|line\/|; wv\)/i.test(ua);
}

/**
 * Que montrer dans l'inscription ? Rien si déjà installée ou sur un navigateur qui ne sait pas installer (bureau…).
 * Le refus des 7 jours de l'invitation habituelle ne s'applique pas ici : l'étape est courte et passable.
 */
export function decideOnboardingInstall(input: { standalone: boolean; ua: string; iosSafari: boolean; hasPrompt: boolean }): OnboardingInstallMode {
  if (input.standalone) return 'skip';
  if (isInAppBrowser(input.ua)) return 'inapp';
  if (input.hasPrompt) return 'native';
  if (input.iosSafari) return 'ios';
  return 'skip';
}

/** Adresse à copier pour la rouvrir dans un vrai navigateur : sans ancre ni paramètre de relecture. */
export function cleanInstallUrl(href: string): string {
  try {
    const url = new URL(href);
    url.hash = '';
    url.searchParams.delete('rejouer');
    return url.toString();
  } catch {
    return href;
  }
}
