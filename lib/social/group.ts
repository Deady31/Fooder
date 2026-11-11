import { readJson, writeJson, randomId } from '../store';
import { arr, obj, str, ts } from './codec';

/**
 * « On mange où ? » : chacun swipe la même sélection, l'appli révèle les restos aimés en commun.
 * Sans serveur, la session voyage par lien : chaque lien de vote contient tout ce que son auteur sait
 * (sélection + votes reçus), et les liens se fusionnent à l'ouverture.
 */

export interface GroupResto {
  id: string;
  name: string;
  cuisine: string;
  quartier?: string;
}

export interface GroupVote {
  voterId: string;
  name: string;
  likes: string[];
  at: number;
}

export interface GroupSession {
  v: 1;
  id: string;
  title: string;
  host: { id: string; name: string };
  restos: GroupResto[];
  votes: GroupVote[];
  at: number;
}

export const GROUPS_KEY = 'fooder_groups';
export const GROUP_LIMITS = { restos: 12, minRestos: 3, votes: 12, title: 40, name: 20 };
const MAX_SESSIONS = 20;

export const readGroups = (): GroupSession[] => readJson<GroupSession[]>(GROUPS_KEY, []);
export const findGroup = (id: string): GroupSession | undefined => readGroups().find(g => g.id === id);

export function createGroup(title: string, host: { id: string; name: string }, restos: GroupResto[], now: number = Date.now()): GroupSession {
  const session: GroupSession = {
    v: 1,
    id: randomId('g', 12),
    title: title.trim().slice(0, GROUP_LIMITS.title) || 'On mange où ?',
    host,
    restos: restos.slice(0, GROUP_LIMITS.restos),
    votes: [],
    at: now,
  };
  saveGroup(session);
  return session;
}

export function saveGroup(session: GroupSession): void {
  const others = readGroups().filter(g => g.id !== session.id);
  writeJson(GROUPS_KEY, [session, ...others].slice(0, MAX_SESSIONS));
}

export function deleteGroup(id: string): void {
  writeJson(GROUPS_KEY, readGroups().filter(g => g.id !== id));
}

/** Fusionne deux états d'une même session (le vote le plus récent de chaque participant l'emporte). */
export function mergeGroups(a: GroupSession, b: GroupSession): GroupSession {
  if (a.id !== b.id) return a;
  const byVoter = new Map<string, GroupVote>();
  for (const v of [...a.votes, ...b.votes]) {
    const prev = byVoter.get(v.voterId);
    if (!prev || v.at > prev.at) byVoter.set(v.voterId, v);
  }
  const restoIds = new Set(a.restos.map(r => r.id));
  return {
    ...a,
    votes: Array.from(byVoter.values()).sort((x, y) => x.at - y.at).slice(-GROUP_LIMITS.votes),
    restos: [...a.restos, ...b.restos.filter(r => !restoIds.has(r.id))].slice(0, GROUP_LIMITS.restos),
    at: Math.max(a.at, b.at),
  };
}

/** Ajoute ou remplace le vote d'un participant. Seuls les restos de la session sont retenus. */
export function withVote(session: GroupSession, vote: GroupVote): GroupSession {
  const valid = new Set(session.restos.map(r => r.id));
  const clean = { ...vote, likes: Array.from(new Set(vote.likes)).filter(id => valid.has(id)) };
  return mergeGroups(session, { ...session, votes: [clean] });
}

export interface GroupResult {
  resto: GroupResto;
  likes: number;
  voters: string[];
  perfect: boolean;
}

export function groupResults(session: GroupSession): GroupResult[] {
  const total = session.votes.length;
  return session.restos
    .map(resto => {
      const voters = session.votes.filter(v => v.likes.includes(resto.id)).map(v => v.name);
      return { resto, likes: voters.length, voters, perfect: total >= 2 && voters.length === total };
    })
    .sort((x, y) => y.likes - x.likes);
}

export function parseGroup(raw: unknown): GroupSession | null {
  const o = obj(raw);
  if (!o || o.v !== 1) return null;
  const id = str(o.id, 40);
  const host = obj(o.host);
  const hostId = str(host?.id, 40);
  const hostName = str(host?.name, GROUP_LIMITS.name);
  if (!id || !/^g[a-z0-9]+$/i.test(id) || !hostId || !hostName) return null;

  const restos: GroupResto[] = [];
  for (const r of arr(o.restos, GROUP_LIMITS.restos)) {
    const ro = obj(r);
    const rid = str(ro?.id, 40);
    const name = str(ro?.name, 60);
    if (!rid || !name || restos.some(x => x.id === rid)) continue;
    restos.push({ id: rid, name, cuisine: str(ro?.cuisine, 40) ?? '', quartier: str(ro?.quartier, 30) ?? undefined });
  }
  if (restos.length < GROUP_LIMITS.minRestos) return null;

  const ids = new Set(restos.map(r => r.id));
  const votes: GroupVote[] = [];
  for (const v of arr(o.votes, GROUP_LIMITS.votes)) {
    const vo = obj(v);
    const voterId = str(vo?.voterId, 40);
    const name = str(vo?.name, GROUP_LIMITS.name);
    if (!voterId || !name || votes.some(x => x.voterId === voterId)) continue;
    const likes = arr(vo?.likes, GROUP_LIMITS.restos)
      .map(l => str(l, 40))
      .filter((l): l is string => Boolean(l) && ids.has(l as string));
    votes.push({ voterId, name, likes: Array.from(new Set(likes)), at: ts(vo?.at) });
  }

  return {
    v: 1,
    id,
    title: str(o.title, GROUP_LIMITS.title) ?? 'On mange où ?',
    host: { id: hostId, name: hostName },
    restos,
    votes,
    at: ts(o.at),
  };
}
