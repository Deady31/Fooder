import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POINTS,
  communityScore,
  createLeaderboardApi,
  fetchLeaderboard,
  fetchMyRank,
  formatRank,
  friendEntries,
  medalFor,
  parseBoardRows,
  parseMyRank,
  rankEntries,
  statsLine,
} from '../lib/cloud/leaderboard';
import type { FriendSnapshot } from '../lib/social/snapshot';

const UID = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

const row = (over: Record<string, unknown> = {}) => ({
  rank: 1, user_id: U2, pseudo: 'lea_mange', avatar_id: 'donut', avatar_bg: 'bubblegum', photos: 2, hearts: 5, score: 35, ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('score communauté', () => {
  it('10 points par photo, 3 par cœur reçu', () => {
    expect(POINTS).toEqual({ photo: 10, heart: 3 });
    expect(communityScore(3, 4)).toBe(42);
    expect(communityScore(0, 0)).toBe(0);
    expect(communityScore(-2, -1)).toBe(0);
  });
});

describe('médailles et rang', () => {
  it('médailles pour le podium seulement', () => {
    expect(medalFor(1)).toBe('🥇');
    expect(medalFor(2)).toBe('🥈');
    expect(medalFor(3)).toBe('🥉');
    expect(medalFor(4)).toBeNull();
    expect(medalFor(null)).toBeNull();
  });

  it('format du rang', () => {
    expect(formatRank(12)).toBe('#12');
    expect(formatRank(1)).toBe('#1');
    expect(formatRank(null)).toBe('—');
    expect(formatRank(0)).toBe('—');
  });
});

describe('parseBoardRows', () => {
  it('lit les lignes serveur et repère la mienne', () => {
    const out = parseBoardRows([row(), row({ rank: 2, user_id: UID, pseudo: 'moi', score: 10, photos: 1, hearts: 0 })], UID);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ rank: 1, name: 'lea_mange', photos: 2, hearts: 5, score: 35, isMe: false });
    expect(out[1].isMe).toBe(true);
    expect(out[1].key).toBe(UID.replace(/-/g, ''));
  });

  it('rejette les lignes invalides et borne les nombres', () => {
    const out = parseBoardRows(
      [row({ user_id: 'pas-un-uuid' }), row({ pseudo: '' }), null, 'x', row({ photos: -4, hearts: 'a', score: 9999999 })],
      null
    );
    expect(out).toHaveLength(1);
    expect(out[0].photos).toBe(0);
    expect(out[0].hearts).toBe(0);
    expect(out[0].score).toBeLessThanOrEqual(1_000_000);
  });

  it('mascotte inconnue : repli sur la mascotte par défaut', () => {
    const out = parseBoardRows([row({ avatar_id: 'inconnu', avatar_bg: '<x>' })], null);
    expect(out[0].avatar.id).not.toBe('inconnu');
    expect(out[0].avatar.bg).not.toBe('<x>');
  });

  it('entrée non tableau : liste vide', () => {
    expect(parseBoardRows(null, null)).toEqual([]);
    expect(parseBoardRows({}, null)).toEqual([]);
  });
});

describe('rankEntries (tri stable, égalités)', () => {
  const e = (key: string, score: number, hearts = 0, photos = 0) => ({
    key, rank: 0, name: key, avatar: { id: 'burger', bg: 'bubblegum' }, isMe: false, photos, hearts, score, level: null,
  });

  it('trie par score puis cœurs puis photos, sans réordonner les ex æquo parfaits', () => {
    const out = rankEntries([e('a', 10, 0, 1), e('b', 30, 0, 3), e('c', 10, 0, 1), e('d', 10, 3, 0)]);
    expect(out.map(x => x.key)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('même score et mêmes cœurs : même rang, le suivant saute', () => {
    const out = rankEntries([e('a', 10, 0, 1), e('b', 30, 0, 3), e('c', 10, 0, 1), e('d', 5, 0, 0)]);
    expect(out.map(x => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it('ne modifie pas le tableau reçu', () => {
    const input = [e('a', 1), e('b', 2)];
    rankEntries(input);
    expect(input.map(x => x.key)).toEqual(['a', 'b']);
  });
});

describe('friendEntries', () => {
  const snap = (id: string, name: string, photos: number, xp: number, over: Partial<FriendSnapshot> = {}): FriendSnapshot => ({
    v: 1, id, name, avatar: { id: 'burger', bg: 'bubblegum' }, level: 2, xp, archetype: 'x', archetypeSticker: 'donut',
    cuisines: [], likes: [], quartiers: [], visits: 0, week: 1, weekVisits: 0, streak: 1, photos, at: 1, ...over,
  });

  it('classe toi et tes amis par photos, puis XP', () => {
    const me = snap('me', 'moi', 2, 100);
    const out = friendEntries(me, [{ snapshot: snap('a', 'ana', 5, 10), addedAt: 1 }, { snapshot: snap('b', 'bob', 2, 300), addedAt: 1 }]);
    expect(out.map(x => x.name)).toEqual(['ana', 'bob', 'moi']);
    expect(out.map(x => x.rank)).toEqual([1, 2, 3]);
    expect(out.find(x => x.isMe)?.name).toBe('moi');
  });

  it('seul : une ligne, la tienne', () => {
    const out = friendEntries(snap('me', 'moi', 0, 0), []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rank: 1, isMe: true });
  });
});

describe('statsLine', () => {
  it('global : photos et cœurs, avec pluriel', () => {
    expect(statsLine({ photos: 1, hearts: 1, level: null } as never)).toBe('1 photo · 1 cœur');
    expect(statsLine({ photos: 3, hearts: 0, level: null } as never)).toBe('3 photos · 0 cœur');
    expect(statsLine({ photos: 0, hearts: 12, level: null } as never)).toBe('0 photo · 12 cœurs');
  });

  it('amis : niveau et photos', () => {
    expect(statsLine({ photos: 2, hearts: null, level: 4 } as never)).toBe('niv. 4 · 2 photos');
  });
});

describe('parseMyRank', () => {
  it('ligne présente : rang et score', () => {
    expect(parseMyRank([{ rank: 12, score: 30, photos: 2, hearts: 3, total: 40 }])).toEqual({ rank: 12, score: 30, photos: 2, hearts: 3, total: 40 });
  });
  it('aucune ligne : pas classé', () => {
    expect(parseMyRank([])).toEqual({ rank: null, score: 0, photos: 0, hearts: 0, total: 0 });
    expect(parseMyRank(null)).toEqual({ rank: null, score: 0, photos: 0, hearts: 0, total: 0 });
  });
});

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
const fakeClient = (rpc: Rpc, session: unknown = { user: { id: UID } }): never =>
  ({ auth: { getSession: async () => ({ data: { session } }) }, rpc }) as never;

describe('repli propre (jamais de crash)', () => {
  it('cloud absent : indisponible', async () => {
    const api = createLeaderboardApi(() => null);
    expect(await api.fetchLeaderboard('week')).toMatchObject({ status: 'unavailable', reason: 'cloud_off', entries: [] });
    expect(await api.fetchMyRank('all')).toMatchObject({ status: 'unavailable', reason: 'cloud_off' });
  });

  it('cloud non configuré dans ce test : le point d’entrée par défaut se replie aussi', async () => {
    expect(await fetchLeaderboard('week')).toMatchObject({ status: 'unavailable' });
    expect(await fetchMyRank('week')).toMatchObject({ status: 'unavailable' });
  });

  it('pas de session : indisponible, sans appel serveur', async () => {
    const rpc = vi.fn();
    const api = createLeaderboardApi(() => fakeClient(rpc as unknown as Rpc, null));
    expect(await api.fetchLeaderboard('week')).toMatchObject({ status: 'unavailable', reason: 'no_session' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('hors ligne : indisponible, sans appel serveur', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const rpc = vi.fn();
    const api = createLeaderboardApi(() => fakeClient(rpc as unknown as Rpc));
    expect(await api.fetchLeaderboard('all')).toMatchObject({ status: 'unavailable', reason: 'offline' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('erreur serveur ou exception : indisponible', async () => {
    const bad = createLeaderboardApi(() => fakeClient(async () => ({ data: null, error: { message: 'boom' } })));
    expect(await bad.fetchLeaderboard('week')).toMatchObject({ status: 'unavailable', reason: 'error' });
    const throws = createLeaderboardApi(() => fakeClient(async () => { throw new Error('réseau'); }));
    expect(await throws.fetchMyRank('week')).toMatchObject({ status: 'unavailable', reason: 'error' });
  });

  it('succès : appelle la bonne fonction avec période et limite, et marque ma ligne', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const api = createLeaderboardApi(() =>
      fakeClient(async (fn, args) => {
        calls.push([fn, args]);
        return fn === 'leaderboard'
          ? { data: [row({ user_id: UID, rank: 1 })], error: null }
          : { data: [{ rank: 1, score: 35, photos: 2, hearts: 5, total: 1 }], error: null };
      })
    );
    const board = await api.fetchLeaderboard('week');
    expect(board.status).toBe('ok');
    expect(board.entries[0].isMe).toBe(true);
    const mine = await api.fetchMyRank('week');
    expect(mine).toMatchObject({ status: 'ok', me: { rank: 1, score: 35 } });
    expect(calls).toEqual([['leaderboard', { period: 'week', lim: 50 }], ['my_rank', { period: 'week' }]]);
  });
});
