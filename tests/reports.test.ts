import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = new Map<string, string>();
beforeEach(() => {
  data.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
  });
  vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
});

describe('signalements', () => {
  it('mémorise sans doublon et relit', async () => {
    const { readReported, reportPlace } = await import('../lib/reports');
    expect(readReported().size).toBe(0);
    reportPlace('a', 'closed');
    reportPlace('a', 'not_restaurant');
    reportPlace('b', 'closed');
    expect(Array.from(readReported()).sort()).toEqual(['a', 'b']);
  });
  it('ignore un stockage corrompu', async () => {
    const { REPORTS_KEY, readReported } = await import('../lib/reports');
    data.set(REPORTS_KEY, '{"x":1}');
    expect(readReported().size).toBe(0);
  });
});
