/**
 * Détection d'appareil pour les mesures d'usage (propriétés de `session_start`).
 * Logique pure (testée dans tests/device.test.ts) : l'environnement est injecté, `readDeviceEnv` fait le seul accès au navigateur.
 *
 * Confidentialité : uniquement des valeurs de listes fermées et des nombres bornés. Jamais le user-agent brut,
 * jamais de modèle de téléphone, jamais d'adresse IP, jamais de ville (le fuseau est ramené à un continent).
 */
import type { TrackProps } from './tracking';

export const PLATFORMS = ['ios', 'android', 'windows', 'macos', 'linux', 'autre'] as const;
export const FORMS = ['mobile', 'tablette', 'ordinateur'] as const;
export const BROWSERS = ['chrome', 'safari', 'firefox', 'edge', 'samsung', 'instagram', 'facebook', 'tiktok', 'autre'] as const;
export const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ar', 'autre'] as const;
export const TZ_REGIONS = ['europe', 'amerique', 'asie', 'afrique', 'oceanie', 'autre'] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Form = (typeof FORMS)[number];
export type BrowserName = (typeof BROWSERS)[number];
export type Lang = (typeof LANGS)[number];
export type TzRegion = (typeof TZ_REGIONS)[number];

export interface DeviceEnv {
  userAgent?: string;
  /** navigator.userAgentData (Chromium) : plateforme et mobile fiables. */
  uaData?: { platform?: string; mobile?: boolean };
  standalone?: boolean;
  screenWidth?: number;
  screenHeight?: number;
  touchPoints?: number;
  language?: string;
  timeZone?: string;
}

export interface DeviceInfo {
  platform: Platform;
  form: Form;
  browser: BrowserName;
  /** Version majeure, 0 si inconnue. */
  browser_v: number;
  installed: boolean;
  screen_w: number;
  screen_h: number;
  lang: Lang;
  tz: TzRegion;
}

const MAX_UA = 600; // on ne lit que le début : un user-agent démesuré n'est pas un vrai navigateur

function detectPlatform(ua: string, uaPlatform: string | undefined, touch: number): Platform {
  const p = (uaPlatform ?? '').toLowerCase();
  if (p) {
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
    if (p === 'windows') return 'windows';
    if (p === 'macos') return touch > 1 ? 'ios' : 'macos';
    if (p === 'linux') return 'linux';
    return 'autre';
  }
  if (/CrOS/.test(ua)) return 'autre';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh|Mac OS X/.test(ua)) return touch > 1 ? 'ios' : 'macos'; // iPad en « site de bureau »
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux|X11/.test(ua)) return 'linux';
  return 'autre';
}

function detectForm(ua: string, platform: Platform, uaMobile: boolean | undefined, width: number, touch: number): Form {
  if (/iPad/.test(ua)) return 'tablette';
  if (/iPhone|iPod/.test(ua)) return 'mobile';
  if (platform === 'ios') return /iPhone|iPod/.test(ua) || width < 700 ? 'mobile' : 'tablette';
  if (platform === 'android') {
    if (uaMobile === true || /Mobile/.test(ua)) return 'mobile';
    if (uaMobile === false || ua) return 'tablette';
  }
  if (platform === 'windows' || platform === 'macos' || platform === 'linux') return 'ordinateur';
  // Aucun indice fiable : largeur d'écran.
  if (width > 0 && width < 600) return 'mobile';
  if (width >= 600 && width < 1100 && touch > 0) return 'tablette';
  if (width >= 600 && width < 1100) return 'tablette';
  return 'ordinateur';
}

const major = (ua: string, re: RegExp): number => {
  const m = ua.match(re);
  const n = m ? parseInt(m[1], 10) : 0;
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : 0;
};

function detectBrowser(ua: string): { browser: BrowserName; browser_v: number } {
  if (/Instagram/.test(ua)) return { browser: 'instagram', browser_v: major(ua, /Instagram[ /](\d+)/) };
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return { browser: 'facebook', browser_v: major(ua, /FBAV\/(\d+)/) };
  if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) return { browser: 'tiktok', browser_v: major(ua, /(?:musical_ly_|TikTok[ /])(\d+)/) };
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return { browser: 'edge', browser_v: major(ua, /Edg(?:e|A|iOS)?\/(\d+)/) };
  if (/SamsungBrowser\//.test(ua)) return { browser: 'samsung', browser_v: major(ua, /SamsungBrowser\/(\d+)/) };
  if (/OPR\/|Opera|OPiOS|Vivaldi|Brave|DuckDuckGo/.test(ua)) return { browser: 'autre', browser_v: 0 };
  if (/Firefox\/|FxiOS\//.test(ua)) return { browser: 'firefox', browser_v: major(ua, /(?:Firefox|FxiOS)\/(\d+)/) };
  if (/Chrome\/|CriOS\//.test(ua)) return { browser: 'chrome', browser_v: major(ua, /(?:Chrome|CriOS)\/(\d+)/) };
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return { browser: 'safari', browser_v: major(ua, /Version\/(\d+)/) };
  return { browser: 'autre', browser_v: 0 };
}

const safeNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const roundScreen = (v: unknown): number => Math.min(10000, Math.round(safeNum(v) / 10) * 10);

export function langBucket(language: unknown): Lang {
  if (typeof language !== 'string') return 'autre';
  const code = language.slice(0, 12).toLowerCase().split(/[-_]/)[0];
  return (LANGS as readonly string[]).includes(code) && code !== 'autre' ? (code as Lang) : 'autre';
}

const TZ_PREFIX: Record<string, TzRegion> = {
  europe: 'europe',
  america: 'amerique',
  asia: 'asie',
  africa: 'afrique',
  australia: 'oceanie',
  pacific: 'oceanie',
};

export function tzRegion(timeZone: unknown): TzRegion {
  if (typeof timeZone !== 'string') return 'autre';
  return TZ_PREFIX[timeZone.slice(0, 40).split('/')[0].toLowerCase()] ?? 'autre';
}

/** Déduit l'appareil depuis un environnement injecté. Ne lève jamais : toute valeur inconnue devient « autre » ou 0. */
export function detectDevice(env: DeviceEnv): DeviceInfo {
  const ua = typeof env?.userAgent === 'string' ? env.userAgent.slice(0, MAX_UA) : '';
  const touch = safeNum(env?.touchPoints);
  const width = safeNum(env?.screenWidth);
  const platform = detectPlatform(ua, env?.uaData?.platform, touch);
  const { browser, browser_v } = detectBrowser(ua);
  return {
    platform,
    form: detectForm(ua, platform, env?.uaData?.mobile, width, touch),
    browser,
    browser_v,
    installed: env?.standalone === true,
    screen_w: roundScreen(env?.screenWidth),
    screen_h: roundScreen(env?.screenHeight),
    lang: langBucket(env?.language),
    tz: tzRegion(env?.timeZone),
  };
}

/** Propriétés de `session_start` : `standalone` (booléen) garde le nom déjà utilisé par le backoffice. */
export function deviceProps(d: DeviceInfo): TrackProps {
  return {
    platform: d.platform,
    form: d.form,
    browser: d.browser,
    browser_v: d.browser_v,
    standalone: d.installed,
    screen_w: d.screen_w,
    screen_h: d.screen_h,
    lang: d.lang,
    tz: d.tz,
  };
}

/** Lit le navigateur (seul accès au DOM de ce module). Chaque lecture est protégée : un navigateur exotique ne casse rien. */
export function readDeviceEnv(): DeviceEnv {
  const env: DeviceEnv = {};
  try {
    const nav = navigator as Navigator & { standalone?: boolean; userAgentData?: { platform?: string; mobile?: boolean } };
    env.userAgent = nav.userAgent;
    env.uaData = nav.userAgentData ? { platform: nav.userAgentData.platform, mobile: nav.userAgentData.mobile } : undefined;
    env.touchPoints = nav.maxTouchPoints;
    env.language = nav.language;
    env.standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
    env.screenWidth = window.screen?.width || window.innerWidth;
    env.screenHeight = window.screen?.height || window.innerHeight;
    env.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* lecture impossible : les champs manquants deviennent « autre » */
  }
  return env;
}
