import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, barShares, deviceLabel, normalizeDevices, normalizeUsers, pageCount, parseUsersQuery } from '../lib/admin/users';

const UID = '5f0c1f8e-4a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('parseUsersQuery', () => {
  it('valeurs par défaut', () => {
    expect(parseUsersQuery(new URLSearchParams(''))).toEqual({ page: 1, q: '', days: 30 });
  });
  it('page bornée, recherche nettoyée et tronquée à 40 caractères', () => {
    expect(parseUsersQuery(new URLSearchParams('page=3')).page).toBe(3);
    expect(parseUsersQuery(new URLSearchParams('page=-4')).page).toBe(1);
    expect(parseUsersQuery(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseUsersQuery(new URLSearchParams('page=999999')).page).toBe(1000);
    expect(parseUsersQuery(new URLSearchParams('q=  Riyan  ')).q).toBe('Riyan');
    expect(parseUsersQuery(new URLSearchParams('q=' + 'a'.repeat(100))).q).toHaveLength(40);
    expect(parseUsersQuery(new URLSearchParams('q=a%00b%1Fc')).q).toBe('abc');
  });
  it('période : seulement 7, 30 ou 90', () => {
    expect(parseUsersQuery(new URLSearchParams('days=7')).days).toBe(7);
    expect(parseUsersQuery(new URLSearchParams('days=12')).days).toBe(30);
  });
});

describe('normalizeUsers : refuse le bruit, ne fabrique rien', () => {
  it('réponse vide ou illisible : zéro utilisateur', () => {
    expect(normalizeUsers(null)).toEqual({ total: 0, rows: [] });
    expect(normalizeUsers('x')).toEqual({ total: 0, rows: [] });
    expect(normalizeUsers({ total: 'a', rows: 5 })).toEqual({ total: 0, rows: [] });
  });
  it('lit une ligne complète et ignore les lignes sans identifiant valide', () => {
    const out = normalizeUsers({
      total: 2,
      rows: [
        { user_id: UID, pseudo: 'Riyan', is_anonymous: true, has_email: false, first_seen: '2026-11-01T10:00:00Z', last_seen: '2026-11-02T10:00:00Z', sessions: 3, active_s: 120, platform: 'ios', form: 'mobile', browser: 'safari', installed: true, likes: 4, passes: 1, opens: 2, checkins: 0, posts: 1, photos: 1, account_exists: true },
        { user_id: 'pas-un-uuid', pseudo: 'x' },
      ],
    });
    expect(out.total).toBe(2);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ user_id: UID, pseudo: 'Riyan', platform: 'ios', browser: 'safari', installed: true, sessions: 3, photos: 1 });
  });
  it('valeurs hors liste fermée : ignorées, nombres négatifs : 0, jamais d’e-mail dans la sortie', () => {
    const out = normalizeUsers({ total: 1, rows: [{ user_id: UID, pseudo: null, platform: '<script>', browser: 'netscape', form: 'frigo', installed: 'oui', sessions: -2, likes: 'x', email: 'a@b.fr' }] });
    const r = out.rows[0];
    expect(r).toMatchObject({ pseudo: null, platform: null, browser: null, form: null, installed: null, sessions: 0, likes: 0 });
    expect(JSON.stringify(r)).not.toContain('a@b.fr');
  });
  it('pseudo borné à 20 caractères', () => {
    expect(normalizeUsers({ total: 1, rows: [{ user_id: UID, pseudo: 'p'.repeat(50) }] }).rows[0].pseudo).toHaveLength(20);
  });
});

describe('deviceLabel', () => {
  it('assemble plateforme et navigateur', () => {
    expect(deviceLabel({ platform: 'ios', browser: 'safari', form: 'mobile', installed: false })).toBe('iOS · Safari');
    expect(deviceLabel({ platform: 'android', browser: 'chrome', form: 'mobile', installed: true })).toBe('Android · Chrome · installée');
    expect(deviceLabel({ platform: 'windows', browser: 'edge', form: 'ordinateur', installed: null })).toBe('Windows · Edge');
  });
  it('inconnu : le dit honnêtement', () => {
    expect(deviceLabel({ platform: null, browser: null, form: null, installed: null })).toBe('Appareil inconnu');
  });
});

describe('normalizeDevices et barShares', () => {
  it('réponse vide : aucun utilisateur', () => {
    expect(normalizeDevices(undefined)).toEqual({ users: 0, platforms: [], browsers: [], forms: [], installed: [] });
  });
  it('lit les répartitions, ignore les entrées invalides', () => {
    const d = normalizeDevices({ users: 4, platforms: [{ key: 'ios', users: 3 }, { key: 'android', users: 1 }, { key: 5, users: 'x' }, { key: 'bidon', users: 2 }], browsers: [], forms: [], installed: [{ key: 'installee', users: 1 }] });
    expect(d.platforms).toEqual([{ key: 'ios', users: 3 }, { key: 'android', users: 1 }]);
    expect(d.installed).toEqual([{ key: 'installee', users: 1 }]);
  });
  it('barShares : pourcentages sur le total, libellés lisibles, ordre décroissant', () => {
    const s = barShares([{ key: 'android', users: 1 }, { key: 'ios', users: 3 }], 'platform');
    expect(s.map(x => x.label)).toEqual(['iOS', 'Android']);
    expect(s.map(x => x.pct)).toEqual([75, 25]);
    expect(barShares([], 'platform')).toEqual([]);
    expect(barShares([{ key: 'ios', users: 0 }], 'platform')[0].pct).toBe(0);
    expect(barShares([{ key: 'inconnu', users: 2 }], 'browser')[0].label).toBe('Inconnu');
  });
});

describe('pageCount', () => {
  it('arrondit au supérieur, au moins 1', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });
});
