import { describe, expect, it } from 'vitest';
import { BROWSERS, FORMS, LANGS, PLATFORMS, TZ_REGIONS, DeviceEnv, detectDevice, deviceProps, langBucket, tzRegion } from '../lib/device';
import { buildEvent, sanitizeTrackProps } from '../lib/tracking';

const env = (over: Partial<DeviceEnv>): DeviceEnv => ({
  userAgent: '',
  standalone: false,
  screenWidth: 390,
  screenHeight: 844,
  touchPoints: 5,
  language: 'fr-FR',
  timeZone: 'Europe/Paris',
  ...over,
});

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  pixelChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/109.0.0.0',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.1.19.101 (iPhone14,5; iOS 17_4; fr_FR; fr; scale=3.00; 1170x2532; 123456789)',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.109;]',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36 trill_2023 musical_ly_32.5.0 BytedanceWebview/d8a21c6',
  chromeos: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

describe('detectDevice : plateforme, type et navigateur', () => {
  it('iPhone Safari', () => {
    const d = detectDevice(env({ userAgent: UA.iphoneSafari }));
    expect(d).toMatchObject({ platform: 'ios', form: 'mobile', browser: 'safari', browser_v: 17 });
  });

  it('iPhone Chrome (CriOS)', () => {
    expect(detectDevice(env({ userAgent: UA.iphoneChrome }))).toMatchObject({ platform: 'ios', form: 'mobile', browser: 'chrome', browser_v: 123 });
  });

  it('iPad (tablette) et iPad en mode « site de bureau » (Macintosh + écran tactile)', () => {
    expect(detectDevice(env({ userAgent: UA.ipad, screenWidth: 820 }))).toMatchObject({ platform: 'ios', form: 'tablette', browser: 'safari' });
    expect(detectDevice(env({ userAgent: UA.ipadDesktopMode, touchPoints: 5, screenWidth: 820 }))).toMatchObject({ platform: 'ios', form: 'tablette' });
  });

  it('Mac sans écran tactile : macOS ordinateur', () => {
    expect(detectDevice(env({ userAgent: UA.macSafari, touchPoints: 0, screenWidth: 1440 }))).toMatchObject({ platform: 'macos', form: 'ordinateur', browser: 'safari', browser_v: 17 });
  });

  it('Android : mobile (token Mobile) ou tablette (sans)', () => {
    expect(detectDevice(env({ userAgent: UA.pixelChrome }))).toMatchObject({ platform: 'android', form: 'mobile', browser: 'chrome', browser_v: 124 });
    expect(detectDevice(env({ userAgent: UA.androidTablet, screenWidth: 800 }))).toMatchObject({ platform: 'android', form: 'tablette', browser: 'chrome' });
  });

  it('navigateur Samsung et Firefox Android', () => {
    expect(detectDevice(env({ userAgent: UA.samsung }))).toMatchObject({ platform: 'android', browser: 'samsung', browser_v: 24 });
    expect(detectDevice(env({ userAgent: UA.firefoxAndroid }))).toMatchObject({ platform: 'android', form: 'mobile', browser: 'firefox', browser_v: 125 });
  });

  it('Windows Chrome / Edge, Linux Firefox, ChromeOS', () => {
    expect(detectDevice(env({ userAgent: UA.winChrome, touchPoints: 0, screenWidth: 1920 }))).toMatchObject({ platform: 'windows', form: 'ordinateur', browser: 'chrome', browser_v: 124 });
    expect(detectDevice(env({ userAgent: UA.winEdge, touchPoints: 0 }))).toMatchObject({ platform: 'windows', browser: 'edge', browser_v: 124 });
    expect(detectDevice(env({ userAgent: UA.linuxFirefox, touchPoints: 0 }))).toMatchObject({ platform: 'linux', form: 'ordinateur', browser: 'firefox', browser_v: 125 });
    expect(detectDevice(env({ userAgent: UA.chromeos, touchPoints: 0 }))).toMatchObject({ platform: 'autre', browser: 'chrome' });
  });

  it('navigateurs intégrés Instagram, Facebook, TikTok', () => {
    expect(detectDevice(env({ userAgent: UA.instagramIos }))).toMatchObject({ platform: 'ios', browser: 'instagram' });
    expect(detectDevice(env({ userAgent: UA.facebookAndroid }))).toMatchObject({ platform: 'android', browser: 'facebook' });
    expect(detectDevice(env({ userAgent: UA.tiktokAndroid }))).toMatchObject({ platform: 'android', browser: 'tiktok' });
  });

  it('navigateur inconnu (Opera) : « autre », version 0', () => {
    expect(detectDevice(env({ userAgent: UA.opera, touchPoints: 0 }))).toMatchObject({ platform: 'windows', browser: 'autre', browser_v: 0 });
  });

  it('userAgentData prime sur le texte pour la plateforme et le mobile', () => {
    const d = detectDevice(env({ userAgent: UA.winChrome, uaData: { platform: 'Android', mobile: true } }));
    expect(d).toMatchObject({ platform: 'android', form: 'mobile' });
    expect(detectDevice(env({ userAgent: UA.pixelChrome, uaData: { platform: 'Chrome OS', mobile: false } })).platform).toBe('autre');
    expect(detectDevice(env({ userAgent: '', uaData: { platform: 'macOS', mobile: false }, touchPoints: 0 })).platform).toBe('macos');
  });

  it('user-agent vide ou absurde : tout en « autre », jamais d’exception', () => {
    expect(detectDevice(env({ userAgent: '' }))).toMatchObject({ platform: 'autre', browser: 'autre', browser_v: 0 });
    expect(detectDevice(env({ userAgent: 'x'.repeat(5000) }))).toMatchObject({ platform: 'autre', browser: 'autre' });
    expect(() => detectDevice({} as DeviceEnv)).not.toThrow();
  });

  it('forme : sans indice, déduite de la largeur d’écran', () => {
    expect(detectDevice(env({ userAgent: '', screenWidth: 390 })).form).toBe('mobile');
    expect(detectDevice(env({ userAgent: '', screenWidth: 820, touchPoints: 0 })).form).toBe('tablette');
    expect(detectDevice(env({ userAgent: '', screenWidth: 1920, touchPoints: 0 })).form).toBe('ordinateur');
  });
});

describe('installée, écran, langue, fuseau', () => {
  it('installed reflète le mode standalone', () => {
    expect(detectDevice(env({ userAgent: UA.pixelChrome, standalone: true })).installed).toBe(true);
    expect(detectDevice(env({ userAgent: UA.pixelChrome, standalone: false })).installed).toBe(false);
  });

  it('taille d’écran arrondie à la dizaine et bornée', () => {
    expect(detectDevice(env({ screenWidth: 393, screenHeight: 852 }))).toMatchObject({ screen_w: 390, screen_h: 850 });
    expect(detectDevice(env({ screenWidth: -5, screenHeight: Number.NaN }))).toMatchObject({ screen_w: 0, screen_h: 0 });
    expect(detectDevice(env({ screenWidth: 99999, screenHeight: 1 }))).toMatchObject({ screen_w: 10000 });
  });

  it('langue : liste fermée, jamais de chaîne libre', () => {
    expect(langBucket('fr-FR')).toBe('fr');
    expect(langBucket('EN_us')).toBe('en');
    expect(langBucket('ja-JP')).toBe('autre');
    expect(langBucket('<script>')).toBe('autre');
    expect(langBucket(undefined)).toBe('autre');
  });

  it('fuseau : région regroupée, jamais la ville', () => {
    expect(tzRegion('Europe/Paris')).toBe('europe');
    expect(tzRegion('America/Argentina/Buenos_Aires')).toBe('amerique');
    expect(tzRegion('Asia/Tokyo')).toBe('asie');
    expect(tzRegion('Pacific/Auckland')).toBe('oceanie');
    expect(tzRegion('Australia/Sydney')).toBe('oceanie');
    expect(tzRegion('UTC')).toBe('autre');
    expect(tzRegion(undefined)).toBe('autre');
  });
});

describe('deviceProps : forme acceptée par app_events', () => {
  const samples = Object.values(UA).map(userAgent => detectDevice(env({ userAgent })));

  it('toutes les valeurs textuelles sont dans les listes fermées', () => {
    for (const d of samples) {
      expect(PLATFORMS).toContain(d.platform);
      expect(FORMS).toContain(d.form);
      expect(BROWSERS).toContain(d.browser);
      expect(LANGS).toContain(d.lang);
      expect(TZ_REGIONS).toContain(d.tz);
    }
  });

  it('survit à sanitizeTrackProps sans rien perdre et passe dans buildEvent', () => {
    for (const d of samples) {
      const props = deviceProps(d);
      expect(sanitizeTrackProps(props)).toEqual(props);
      expect(Object.keys(props).length).toBeLessThanOrEqual(20);
      expect(JSON.stringify(props).length).toBeLessThan(400);
      const ev = buildEvent('session_start', props, { sessionId: 's1', screen: null, now: 0 });
      expect(ev?.props).toEqual(props);
    }
  });

  it('expose les clés attendues par admin_users (platform, browser, standalone)', () => {
    const p = deviceProps(detectDevice(env({ userAgent: UA.iphoneSafari, standalone: true })));
    expect(p).toMatchObject({ platform: 'ios', form: 'mobile', browser: 'safari', browser_v: 17, standalone: true, screen_w: 390, screen_h: 840, lang: 'fr', tz: 'europe' });
    expect(p).not.toHaveProperty('installed');
  });
});
