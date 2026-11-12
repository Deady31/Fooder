import { describe, expect, it } from 'vitest';
import { DISMISS_MS, decideInstall, isDismissed, isIos, isIosSafari, isStandalone } from '../components/pwa/installLogic';

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
