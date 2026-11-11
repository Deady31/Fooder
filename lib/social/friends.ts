import { Restaurant } from '../../data/mockRestaurants';
import { computeDNA } from '../../hooks/useFoodDNA';
import { computeLevel } from '../../hooks/useGamification';
import { AvatarChoice, DEFAULT_AVATAR } from '../avatars';
import { FeedPost, POSTS_KEY } from '../feed';
import { getMe } from '../identity';
import { readJson, writeJson } from '../store';
import { visitsThisWeek, weekIndex, weeklyStreak } from '../streak';
import { readVisits, visitedQuartiers } from '../visits';
import { encodePayload } from './codec';
import { FriendSnapshot, SNAPSHOT_LIMITS, compactSnapshot } from './snapshot';

export interface Friend {
  snapshot: FriendSnapshot;
  addedAt: number;
}

export const FRIENDS_KEY = 'fooder_friends';
const MAX_FRIENDS = 200;

export const readFriends = (): Friend[] => readJson<Friend[]>(FRIENDS_KEY, []);

/** Ajoute un ami ou met à jour sa carte si elle est plus récente. Retourne « added », « updated » ou « same ». */
export function upsertFriend(snapshot: FriendSnapshot, now: number = Date.now()): 'added' | 'updated' | 'same' | 'self' {
  if (snapshot.id === getMe().id) return 'self';
  const list = readFriends();
  const existing = list.find(f => f.snapshot.id === snapshot.id);
  if (existing && existing.snapshot.at >= snapshot.at) return 'same';
  const next = existing
    ? list.map(f => (f.snapshot.id === snapshot.id ? { ...f, snapshot } : f))
    : [...list, { snapshot, addedAt: now }].slice(-MAX_FRIENDS);
  writeJson(FRIENDS_KEY, next);
  return existing ? 'updated' : 'added';
}

export function removeFriend(id: string): void {
  writeJson(FRIENDS_KEY, readFriends().filter(f => f.snapshot.id !== id));
}

/** Construit la carte publique de l'utilisateur à partir de ses données locales. */
export function buildMySnapshot(now: number = Date.now()): FriendSnapshot {
  const me = getMe();
  const avatar = { ...DEFAULT_AVATAR, ...readJson<Partial<AvatarChoice>>('fooder_avatar', {}) };
  const xp = readJson<{ total?: number }>('fooder_xp', {}).total ?? 0;
  const dna = computeDNA();
  const likes = readJson<Restaurant[]>('fooder_likes', []);
  const visits = readVisits();
  const times = visits.map(v => v.at);
  const photos = readJson<FeedPost[]>(POSTS_KEY, []).filter(p => p.photo).length;

  const counts = new Map<string, number>();
  likes.forEach(r => counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1));

  return {
    v: 1,
    id: me.id,
    name: me.name,
    avatar,
    level: computeLevel(xp),
    xp,
    archetype: dna.archetype,
    archetypeSticker: dna.archetypeSticker,
    cuisines: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, SNAPSHOT_LIMITS.cuisines),
    likes: likes
      .slice(-SNAPSHOT_LIMITS.likes)
      .reverse()
      .map(r => [r.id, r.name.slice(0, 60), r.cuisine.slice(0, SNAPSHOT_LIMITS.label)]),
    quartiers: Array.from(visitedQuartiers(visits)),
    visits: visits.length,
    week: weekIndex(now),
    weekVisits: visitsThisWeek(times, now),
    streak: weeklyStreak(times, now).current,
    photos,
    at: now,
    code: me.code,
  };
}

const origin = (): string => (typeof window !== 'undefined' ? window.location.origin : 'https://fooder-tawny.vercel.app');

/** Lien d'ajout en ami. La version « qr » est allégée pour rester scannable. */
export async function friendLink(snapshot: FriendSnapshot, variant: 'full' | 'qr' = 'full'): Promise<string> {
  const payload = await encodePayload(variant === 'qr' ? compactSnapshot(snapshot) : snapshot);
  return `${origin()}/amis/ajouter#p=${payload}`;
}

/** Classement de la semaine : toi + tes amis, par visites cette semaine (cartes d'une autre semaine = 0). */
export function weeklyRanking(me: FriendSnapshot, friends: Friend[], now: number = Date.now()) {
  const cur = weekIndex(now);
  return [me, ...friends.map(f => f.snapshot)]
    .map(s => ({ snapshot: s, isMe: s.id === me.id, score: s.week === cur ? s.weekVisits : 0, stale: s.week !== cur }))
    .sort((a, b) => b.score - a.score || b.snapshot.xp - a.snapshot.xp);
}
