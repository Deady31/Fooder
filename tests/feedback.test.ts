import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEEDBACK, FEEDBACK_KEY, HAPTIC_PATTERNS, HapticKind, haptic, readFeedbackPrefs, writeFeedbackPrefs } from '../lib/feedback';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

let vibrate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vibrate = vi.fn(() => true);
  vi.stubGlobal('localStorage', makeStorage());
  vi.stubGlobal('window', { dispatchEvent: () => true });
  vi.stubGlobal('navigator', { vibrate });
});
afterEach(() => vi.unstubAllGlobals());

describe('haptic', () => {
  const kinds: HapticKind[] = ['tap', 'like', 'success', 'level', 'error'];

  it('motifs distincts pour tap, like, succès, niveau, erreur', () => {
    const patterns = kinds.map(k => JSON.stringify(HAPTIC_PATTERNS[k]));
    expect(new Set(patterns).size).toBe(kinds.length);
  });

  it('vibre avec le motif du type demandé', () => {
    for (const k of kinds) {
      expect(haptic(k)).toBe(true);
      expect(vibrate).toHaveBeenLastCalledWith(HAPTIC_PATTERNS[k]);
    }
  });

  it('désactivable via le réglage stocké', () => {
    writeFeedbackPrefs({ haptics: false });
    expect(readFeedbackPrefs()).toEqual({ ...DEFAULT_FEEDBACK, haptics: false });
    expect(haptic('level')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('sans API de vibration (iOS Safari) : renvoie false sans planter', () => {
    vi.stubGlobal('navigator', {});
    expect(haptic('success')).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('refus'); } });
    expect(haptic('success')).toBe(false);
  });

  it('réglages corrompus : valeurs par défaut (vibrations actives, son coupé)', () => {
    localStorage.setItem(FEEDBACK_KEY, '{oups');
    expect(readFeedbackPrefs()).toEqual(DEFAULT_FEEDBACK);
    expect(DEFAULT_FEEDBACK).toEqual({ haptics: true, sound: false });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ haptics: 'non', sound: 1 }));
    expect(readFeedbackPrefs()).toEqual(DEFAULT_FEEDBACK);
  });
});
