/**
 * Fusion des données locales et du compte (nouvel appareil, connexion après usage hors ligne).
 * Règle générale : on n'efface jamais une donnée à la fusion ; les listes sont unies, les compteurs gardent le max.
 */

export const SYNC_KEYS = [
  'fooder_likes',
  'fooder_dislikes',
  'fooder_visits',
  'fooder_checkins',
  'fooder_xp',
  'fooder_achievements',
  'fooder_avatar',
  'fooder_preferences',
  'fooder_onboarding_done',
  'fooder_profile',
  'fooder_defis',
  'fooder_post_likes',
  'fooder_comments',
  'fooder_friends',
  'fooder_streak',
] as const;

export type SyncKey = (typeof SYNC_KEYS)[number];
export type SyncData = Partial<Record<SyncKey, unknown>>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function unionBy(local: unknown, remote: unknown, keyOf: (x: Obj) => string | null, prefer?: (a: Obj, b: Obj) => Obj): Obj[] {
  const out: Obj[] = [];
  const index = new Map<string, number>();
  for (const item of [...asArray(local), ...asArray(remote)]) {
    if (!isObj(item)) continue;
    const k = keyOf(item);
    if (!k) continue;
    const at = index.get(k);
    if (at === undefined) {
      index.set(k, out.length);
      out.push(item);
    } else if (prefer) {
      out[at] = prefer(out[at], item);
    }
  }
  return out;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const numOf = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function mergeKey(key: SyncKey, local: unknown, remote: unknown): unknown {
  if (remote === undefined || remote === null) return local;
  if (local === undefined || local === null) return remote;
  switch (key) {
    case 'fooder_likes':
    case 'fooder_dislikes':
      return unionBy(local, remote, x => str(x.id));
    case 'fooder_visits':
      return unionBy(local, remote, x => (str(x.restId) ? `${x.restId}@${numOf(x.at)}` : null)).sort((a, b) => numOf(a.at) - numOf(b.at));
    case 'fooder_checkins':
      return unionBy(local, remote, x => str(x.restId), (a, b) => (a.status === 'pending' ? b : a));
    case 'fooder_defis':
      return unionBy(local, remote, x => str(x.id), (a, b) => ({ ...a, revealed: Boolean(a.revealed || b.revealed), done: Boolean(a.done || b.done) }));
    case 'fooder_comments':
      return unionBy(local, remote, x => str(x.id));
    case 'fooder_friends':
      return unionBy(
        local,
        remote,
        x => (isObj(x.snapshot) ? str(x.snapshot.id) : null),
        (a, b) => (numOf((b.snapshot as Obj)?.at) > numOf((a.snapshot as Obj)?.at) ? b : a)
      );
    case 'fooder_achievements':
    case 'fooder_post_likes':
      return Array.from(new Set([...asArray(local), ...asArray(remote)].filter((x): x is string => typeof x === 'string')));
    case 'fooder_xp':
      return { ...(isObj(remote) ? remote : {}), ...(isObj(local) ? local : {}), total: Math.max(numOf(isObj(local) ? local.total : 0), numOf(isObj(remote) ? remote.total : 0)) };
    case 'fooder_streak':
      return numOf(isObj(remote) ? remote.count : 0) > numOf(isObj(local) ? local.count : 0) ? remote : local;
    default:
      // Préférences, mascotte, onboarding : la version locale l'emporte
      return local;
  }
}

export function mergeAll(local: SyncData, remote: SyncData): SyncData {
  const out: SyncData = {};
  for (const k of SYNC_KEYS) {
    const v = mergeKey(k, local[k], remote[k]);
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}
