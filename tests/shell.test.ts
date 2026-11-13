import { describe, expect, it } from 'vitest';
import { applyHidden, badgeLabel, decideEntry, isTabActive, pageEntry, tabIndexAfter } from '../lib/shell';
import { AppNotification, mergeNotifications } from '../lib/notifications';

const REF = 'a1b2c3d4e5f6';

describe('decideEntry', () => {
  it('inscrit : va directement sur /swipe', () => {
    expect(decideEntry({ registered: true, search: '' })).toEqual({ destination: '/swipe', ref: null });
  });
  it('non inscrit : onboarding', () => {
    expect(decideEntry({ registered: false, search: '' }).destination).toBe('/onboarding');
  });
  it('mémorise un ?ref= valide quel que soit le statut', () => {
    expect(decideEntry({ registered: false, search: `?ref=${REF}` })).toEqual({ destination: '/onboarding', ref: REF });
    expect(decideEntry({ registered: true, search: `?ref=${REF}` })).toEqual({ destination: '/swipe', ref: REF });
  });
  it('ignore un ref invalide ou absent', () => {
    expect(decideEntry({ registered: false, search: '?ref=zz' }).ref).toBeNull();
    expect(decideEntry({ registered: false, search: '?x=1' }).ref).toBeNull();
  });
});

describe('isTabActive', () => {
  it('exact et sous-chemin, pas de faux positif', () => {
    expect(isTabActive('/map', '/map')).toBe(true);
    expect(isTabActive('/map/x', '/map')).toBe(true);
    expect(isTabActive('/mapping', '/map')).toBe(false);
    expect(isTabActive(null, '/map')).toBe(false);
  });
});

describe('tabIndexAfter', () => {
  it('boucle et gère Début/Fin', () => {
    expect(tabIndexAfter('ArrowRight', 4, 5)).toBe(0);
    expect(tabIndexAfter('ArrowLeft', 0, 5)).toBe(4);
    expect(tabIndexAfter('Home', 3, 5)).toBe(0);
    expect(tabIndexAfter('End', 1, 5)).toBe(4);
    expect(tabIndexAfter('a', 1, 5)).toBeNull();
    expect(tabIndexAfter('ArrowRight', -1, 5)).toBeNull();
  });
});

describe('badgeLabel', () => {
  it('masque à 0, plafonne à 99+', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(-3)).toBeNull();
    expect(badgeLabel(Number.NaN)).toBeNull();
    expect(badgeLabel(7)).toBe('7');
    expect(badgeLabel(120)).toBe('99+');
  });
});

describe('pageEntry', () => {
  it('onglet frère : fondu court sans déplacement', () => {
    const e = pageEntry('/feed', false);
    expect(e.initial).toEqual({ opacity: 0 });
    expect(e.transition.duration).toBeLessThanOrEqual(0.15);
  });
  it('écran enfant : entrée latérale', () => {
    expect(pageEntry('/amis/ajouter', false).initial).toMatchObject({ x: 24 });
    expect(pageEntry('/classement', false).initial).toMatchObject({ x: 24 });
  });
  it('mouvement réduit : aucun déplacement ni durée', () => {
    const e = pageEntry('/classement', true);
    expect(e.initial).toEqual({ opacity: 1 });
    expect(e.transition.duration).toBe(0);
  });
});

describe('applyHidden', () => {
  it('pose et retire data-hidden', () => {
    const attrs = new Set<string>();
    const root = { toggleAttribute: (n: string, on: boolean) => (on ? attrs.add(n) : attrs.delete(n)) };
    applyHidden(root, true);
    expect(attrs.has('data-hidden')).toBe(true);
    applyHidden(root, false);
    expect(attrs.has('data-hidden')).toBe(false);
  });
});

const n = (id: string, createdAt: number): AppNotification =>
  ({ id, kind: 'system', title: id, body: '', createdAt, read: false });

describe('mergeNotifications (annuler « Tout effacer »)', () => {
  it('restaure l\'instantané et garde les nouvelles arrivées, sans doublon, du plus récent au plus ancien', () => {
    const snapshot = [n('a', 30), n('b', 10)];
    const current = [n('c', 40), n('a', 30)];
    expect(mergeNotifications(current, snapshot).map(x => x.id)).toEqual(['c', 'a', 'b']);
  });
  it('liste vide + instantané = instantané', () => {
    expect(mergeNotifications([], [n('a', 1)])).toHaveLength(1);
  });
  it('ne mute pas ses entrées', () => {
    const snap = [n('a', 1)];
    mergeNotifications([], snap);
    expect(snap).toEqual([n('a', 1)]);
  });
});

describe('contraste des étiquettes inactives', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  it('plum-soft et plum-muted ≥ 4,5:1 sur cream', () => {
    expect(ratio('#6B5774', '#FFF6E5')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#5E4A66', '#FFF6E5')).toBeGreaterThanOrEqual(4.5);
  });
});
