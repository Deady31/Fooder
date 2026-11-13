import { describe, expect, it, vi } from 'vitest';
import { createInstallCapture } from '../components/pwa/installCapture';
import { DISMISS_MS, cleanInstallUrl, decideInstall, decideOnboardingInstall, isInAppBrowser, isDismissed, isIos, isIosSafari, isStandalone } from '../components/pwa/installLogic';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
const IPHONE_INSTA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
const IPADOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('détection iOS', () => {
  it('iPhone', () => expect(isIos({ ua: IPHONE_SAFARI })).toBe(true));
  it('iPadOS se fait passer pour un Mac, mais est tactile', () => {
    expect(isIos({ ua: IPADOS, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ ua: IPADOS, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });
  it('Android non', () => expect(isIos({ ua: ANDROID })).toBe(false));
  it('Safari uniquement', () => {
    expect(isIosSafari({ ua: IPHONE_SAFARI })).toBe(true);
    expect(isIosSafari({ ua: IPHONE_CHROME })).toBe(false);
    expect(isIosSafari({ ua: IPHONE_INSTA })).toBe(false);
    expect(isIosSafari({ ua: ANDROID })).toBe(false);
  });
});

describe('isStandalone', () => {
  it('display-mode ou navigator.standalone', () => {
    expect(isStandalone({ displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ navigatorStandalone: true })).toBe(true);
    expect(isStandalone({})).toBe(false);
  });
});

describe('isDismissed', () => {
  const now = 1_000_000_000_000;
  it('jamais refusé', () => expect(isDismissed(null, now)).toBe(false));
  it('refus récent', () => expect(isDismissed(now - DISMISS_MS + 1, now)).toBe(true));
  it('réapparaît après 7 jours', () => {
    expect(DISMISS_MS).toBe(7 * 24 * 3600 * 1000);
    expect(isDismissed(now - DISMISS_MS, now)).toBe(false);
  });
  it('valeur invalide ou future ignorée', () => {
    expect(isDismissed(NaN, now)).toBe(false);
    expect(isDismissed(now + 10_000, now)).toBe(false);
  });
});

describe('decideInstall', () => {
  const base = { standalone: false, iosSafari: false, hasPrompt: false, dismissedAt: null, now: 1_000_000_000_000 };
  it('déjà installée : rien', () => {
    expect(decideInstall({ ...base, standalone: true, hasPrompt: true })).toBe('hidden');
    expect(decideInstall({ ...base, standalone: true, iosSafari: true })).toBe('hidden');
  });
  it('Android avec prompt', () => expect(decideInstall({ ...base, hasPrompt: true })).toBe('android'));
  it('iOS Safari', () => expect(decideInstall({ ...base, iosSafari: true })).toBe('ios'));
  it('ni prompt ni iOS : rien', () => expect(decideInstall(base)).toBe('hidden'));
  it('refus récent : rien', () => {
    expect(decideInstall({ ...base, hasPrompt: true, dismissedAt: base.now - 1000 })).toBe('hidden');
    expect(decideInstall({ ...base, iosSafari: true, dismissedAt: base.now - 1000 })).toBe('hidden');
  });
  it('refus ancien : réapparaît', () => {
    expect(decideInstall({ ...base, hasPrompt: true, dismissedAt: base.now - DISMISS_MS - 1 })).toBe('android');
  });
});

const TIKTOK = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 musical_ly_30.0 BytedanceWebview/d8a21c6';
const FB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

describe('isInAppBrowser', () => {
  it('reconnaît Instagram, TikTok, Facebook', () => {
    for (const ua of [IPHONE_INSTA, TIKTOK, FB]) expect(isInAppBrowser(ua), ua).toBe(true);
  });
  it('pas les vrais navigateurs', () => {
    for (const ua of [IPHONE_SAFARI, IPHONE_CHROME, ANDROID, DESKTOP]) expect(isInAppBrowser(ua), ua).toBe(false);
  });
});

describe('decideOnboardingInstall', () => {
  const base = { standalone: false, ua: DESKTOP, iosSafari: false, hasPrompt: false };
  it('déjà installée : étape ignorée, quel que soit le navigateur', () => {
    expect(decideOnboardingInstall({ ...base, standalone: true, hasPrompt: true })).toBe('skip');
    expect(decideOnboardingInstall({ ...base, standalone: true, ua: IPHONE_INSTA })).toBe('skip');
  });
  it('Android/Chrome avec invite : installation native', () => {
    expect(decideOnboardingInstall({ ...base, ua: ANDROID, hasPrompt: true })).toBe('native');
  });
  it('Android/Chrome sans invite (pas encore reçue) : ignorée', () => {
    expect(decideOnboardingInstall({ ...base, ua: ANDROID })).toBe('skip');
  });
  it('iOS Safari : mode d’emploi', () => {
    expect(decideOnboardingInstall({ ...base, ua: IPHONE_SAFARI, iosSafari: true })).toBe('ios');
  });
  it('navigateur intégré : copier le lien, même avec une invite', () => {
    expect(decideOnboardingInstall({ ...base, ua: IPHONE_INSTA })).toBe('inapp');
    expect(decideOnboardingInstall({ ...base, ua: TIKTOK, hasPrompt: true })).toBe('inapp');
  });
  it('bureau sans invite et Chrome iOS : ignorée', () => {
    expect(decideOnboardingInstall(base)).toBe('skip');
    expect(decideOnboardingInstall({ ...base, ua: IPHONE_CHROME })).toBe('skip');
  });
});

describe('cleanInstallUrl', () => {
  it('retire l’ancre et rejouer, garde le reste', () => {
    expect(cleanInstallUrl('https://fooder.app/onboarding?ref=ABC&rejouer=1#x')).toBe('https://fooder.app/onboarding?ref=ABC');
    expect(cleanInstallUrl('https://fooder.app/')).toBe('https://fooder.app/');
  });
  it('texte invalide renvoyé tel quel', () => {
    expect(cleanInstallUrl('pas une url')).toBe('pas une url');
  });
});

describe('capture de beforeinstallprompt', () => {
  const fire = (target: EventTarget, type: string) => {
    const e = new Event(type, { cancelable: true });
    target.dispatchEvent(e);
    return e;
  };

  it('garde l’événement (et bloque la bannière native) pour plus tard', () => {
    const target = new EventTarget();
    const cap = createInstallCapture(target);
    cap.start();
    const e = fire(target, 'beforeinstallprompt');
    expect(e.defaultPrevented).toBe(true);
    expect(cap.get()).toBe(e);
  });

  it('start est idempotent : un seul écouteur', () => {
    const target = new EventTarget();
    const cap = createInstallCapture(target);
    const cb = vi.fn();
    cap.subscribe(cb);
    cap.start();
    cap.start();
    fire(target, 'beforeinstallprompt');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('rien avant start ; appinstalled et clear l’oublient ; unsubscribe fonctionne', () => {
    const target = new EventTarget();
    const cap = createInstallCapture(target);
    fire(target, 'beforeinstallprompt');
    expect(cap.get()).toBeNull();
    cap.start();
    fire(target, 'beforeinstallprompt');
    expect(cap.get()).not.toBeNull();
    fire(target, 'appinstalled');
    expect(cap.get()).toBeNull();
    fire(target, 'beforeinstallprompt');
    const cb = vi.fn();
    const off = cap.subscribe(cb);
    cap.clear();
    expect(cap.get()).toBeNull();
    off();
    fire(target, 'beforeinstallprompt');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
