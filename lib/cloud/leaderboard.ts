import { cloud } from './client';
import { AVATARS, AVATAR_BACKGROUNDS, AvatarChoice, DEFAULT_AVATAR } from '../avatars';
import type { Friend } from '../social/friends';
import type { FriendSnapshot } from '../social/snapshot';

/**
 * Classement « Score communauté ». Le score est calculé par le serveur (fonctions SQL leaderboard / my_rank) à partir des posts
 * avec photo et des cœurs reçus : le client ne fait qu'afficher. Ici : appels avec repli propre + mise en forme pure.
 */

export type Period = 'week' | 'all';

/** Barème, identique à celui de la migration 20261114000000_leaderboard.sql (le serveur fait foi). */
export const POINTS = { photo: 10, heart: 3 } as const;

export const communityScore = (photos: number, hearts: number): number =>
  Math.max(0, photos) * POINTS.photo + Math.max(0, hearts) * POINTS.heart;

// ═════════════════════════ Mise en forme (pure) ═════════════════════════

export interface BoardEntry {
  key: string;
  rank: number;
  name: string;
  avatar: AvatarChoice;
  isMe: boolean;
  photos: number;
  /** null pour le classement des amis (les cœurs reçus ne sont pas dans leurs cartes) */
  hearts: number | null;
  score: number;
  /** Renseigné pour le classement des amis */
  level: number | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const medalFor = (rank: number | null): string | null => (rank !== null && rank >= 1 && rank <= 3 ? MEDALS[rank - 1] : null);

export const formatRank = (rank: number | null): string => (rank !== null && rank >= 1 ? `#${rank}` : '—');

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

/** Ligne de détails sous le pseudo. */
export function statsLine(e: Pick<BoardEntry, 'photos' | 'hearts' | 'level'>): string {
  if (e.hearts === null) return `niv. ${e.level ?? 1} · ${plural(e.photos, 'photo', 'photos')}`;
  return `${plural(e.photos, 'photo', 'photos')} · ${plural(e.hearts, 'cœur', 'cœurs')}`;
}

/**
 * Tri stable (score, puis cœurs, puis photos) et rangs « à égalité » : mêmes score et cœurs = même rang, le suivant saute.
 * Ne modifie pas le tableau reçu.
 */
export function rankEntries(entries: readonly BoardEntry[]): BoardEntry[] {
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || (b.e.hearts ?? 0) - (a.e.hearts ?? 0) || b.e.photos - a.e.photos || a.i - b.i)
    .map(x => x.e);
  const out: BoardEntry[] = [];
  sorted.forEach((e, i) => {
    const prev = out[i - 1];
    const tied = prev && prev.score === e.score && (prev.hearts ?? 0) === (e.hearts ?? 0) && prev.photos === e.photos;
    out.push({ ...e, rank: tied ? prev.rank : i + 1 });
  });
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATAR_IDS = new Set(AVATARS.map(a => a.id));
const BG_IDS = new Set<string>(AVATAR_BACKGROUNDS.map(b => b.id));

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(Math.max(n, 0), max);
};

/** Valide les lignes renvoyées par `leaderboard` (contenu non fiable) ; ignore celles qui sont invalides. */
export function parseBoardRows(raw: unknown, myUid: string | null): BoardEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardEntry[] = [];
  for (const r of raw) {
    if (!isObj(r) || typeof r.user_id !== 'string' || !UUID_RE.test(r.user_id)) continue;
    const name = typeof r.pseudo === 'string' ? r.pseudo.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) : '';
    if (!name) continue;
    const id = typeof r.avatar_id === 'string' && AVATAR_IDS.has(r.avatar_id) ? r.avatar_id : DEFAULT_AVATAR.id;
    const bg = typeof r.avatar_bg === 'string' && BG_IDS.has(r.avatar_bg) ? r.avatar_bg : DEFAULT_AVATAR.bg;
    out.push({
      key: r.user_id.replace(/-/g, '').toLowerCase(),
      rank: Math.max(1, int(r.rank, 100_000)),
      name,
      avatar: { id, bg },
      isMe: myUid !== null && r.user_id.toLowerCase() === myUid.toLowerCase(),
      photos: int(r.photos, 100_000),
      hearts: int(r.hearts, 1_000_000),
      score: int(r.score, 1_000_000),
      level: null,
    });
  }
  return out;
}

/** Classement des amis : toi + tes amis, par photos puis XP, à partir des cartes locales (rien n'est envoyé au serveur). */
export function friendEntries(me: FriendSnapshot, friends: readonly Friend[]): BoardEntry[] {
  const seen = new Set<string>();
  const snaps = [me, ...friends.map(f => f.snapshot)].filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  const entries: BoardEntry[] = snaps.map(s => ({
    key: s.id,
    rank: 0,
    name: s.name,
    avatar: s.avatar,
    isMe: s.id === me.id,
    photos: s.photos,
    hearts: null,
    score: s.photos,
    level: s.level,
  }));
  // Photos d'abord, XP pour départager ; égalité parfaite = même rang.
  const xpOf = new Map(snaps.map(s => [s.id, s.xp]));
  const sorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || (xpOf.get(b.e.key) ?? 0) - (xpOf.get(a.e.key) ?? 0) || a.i - b.i)
    .map(x => x.e);
  const out: BoardEntry[] = [];
  sorted.forEach((e, i) => {
    const prev = out[i - 1];
    const tied = prev && prev.score === e.score && xpOf.get(prev.key) === xpOf.get(e.key);
    out.push({ ...e, rank: tied ? prev.rank : i + 1 });
  });
  return out;
}

export interface MyRank {
  rank: number | null;
  score: number;
  photos: number;
  hearts: number;
  total: number;
}

export function parseMyRank(raw: unknown): MyRank {
  const r = Array.isArray(raw) && isObj(raw[0]) ? raw[0] : null;
  if (!r) return { rank: null, score: 0, photos: 0, hearts: 0, total: 0 };
  const rank = int(r.rank, 100_000);
  return { rank: rank >= 1 ? rank : null, score: int(r.score, 1_000_000), photos: int(r.photos, 100_000), hearts: int(r.hearts, 1_000_000), total: int(r.total, 1_000_000) };
}

// ═════════════════════════ Appels serveur ═════════════════════════

export type Unavailable = 'cloud_off' | 'no_session' | 'offline' | 'error';

/** Résultat à plat (projet non strict) : status « ok » = données valides, « unavailable » = reason expliqué, jamais d'exception. */
export interface BoardResult {
  status: 'ok' | 'unavailable';
  reason?: Unavailable;
  entries: BoardEntry[];
}

export interface RankResult {
  status: 'ok' | 'unavailable';
  reason?: Unavailable;
  me: MyRank;
}

const NO_RANK: MyRank = { rank: null, score: 0, photos: 0, hearts: 0, total: 0 };
const TOP = 50;
const TIMEOUT_MS = 8000;

interface RpcClient {
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

const withTimeout = <T,>(p: PromiseLike<T>): Promise<T> =>
  Promise.race([Promise.resolve(p), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);

/** Fabrique les appels (client injecté pour les tests). */
export function createLeaderboardApi(getClient: () => RpcClient | null) {
  async function call(fn: string, args: Record<string, unknown>): Promise<{ reason?: Unavailable; data?: unknown; uid?: string }> {
    const sb = getClient();
    if (!sb) return { reason: 'cloud_off' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { reason: 'offline' };
    try {
      const { data: s } = await withTimeout(sb.auth.getSession());
      if (!s.session) return { reason: 'no_session' };
      const { data, error } = await withTimeout(sb.rpc(fn, args));
      if (error) return { reason: 'error' };
      return { data, uid: s.session.user.id };
    } catch {
      return { reason: 'error' };
    }
  }

  return {
    async fetchLeaderboard(period: Period): Promise<BoardResult> {
      const r = await call('leaderboard', { period, lim: TOP });
      if (r.reason) return { status: 'unavailable', reason: r.reason, entries: [] };
      return { status: 'ok', entries: parseBoardRows(r.data, r.uid ?? null) };
    },
    async fetchMyRank(period: Period): Promise<RankResult> {
      const r = await call('my_rank', { period });
      if (r.reason) return { status: 'unavailable', reason: r.reason, me: NO_RANK };
      return { status: 'ok', me: parseMyRank(r.data) };
    },
  };
}

const api = createLeaderboardApi(() => cloud() as unknown as RpcClient | null);

export const fetchLeaderboard = (period: Period): Promise<BoardResult> => api.fetchLeaderboard(period);
export const fetchMyRank = (period: Period): Promise<RankResult> => api.fetchMyRank(period);
