import { RealtimeChannel } from '@supabase/supabase-js';
import { cloud, photoUrl, PHOTO_BUCKET } from './client';
import { FriendSnapshot, parseSnapshot } from '../social/snapshot';
import { readFriends, upsertFriend } from '../social/friends';
import { GroupSession, GroupVote, mergeGroups, saveGroup, findGroup } from '../social/group';
import { FeedPost, Verdict } from '../feed';
import { StickerName, stickerFor } from '../stickers';
import { writeJson } from '../store';
import { FRIENDS_KEY } from '../social/friends';

// ═════════════════════════ Amis ═════════════════════════

interface ProfileRow {
  id: string;
  name: string;
  avatar_id: string;
  avatar_bg: string;
  card: unknown;
}

/** Transforme un profil serveur en carte d'ami validée (le contenu de « card » reste non fiable). */
export function cardFromProfile(row: ProfileRow): FriendSnapshot | null {
  const base = typeof row.card === 'object' && row.card !== null ? (row.card as Record<string, unknown>) : {};
  return parseSnapshot({
    v: 1,
    cuisines: [],
    likes: [],
    quartiers: [],
    ...base,
    id: row.id.replace(/-/g, ''),
    name: row.name,
    avatar: { id: row.avatar_id, bg: row.avatar_bg },
  });
}

/** Ajout réciproque côté serveur à partir du code d'ami contenu dans le lien. */
export async function addFriendByCode(code: string): Promise<FriendSnapshot | null> {
  const sb = cloud();
  if (!sb) return null;
  const { data, error } = await sb.rpc('add_friend', { code });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const snap = cardFromProfile(data[0] as ProfileRow);
  if (snap) upsertFriend(snap);
  return snap;
}

/**
 * Après passage d'un compte anonyme à un compte existant : les amitiés du compte anonyme restent côté serveur sur l'ancien
 * identifiant. On recrée celles que l'appareil connaît (amis avec code d'ami) sur le nouveau compte. Retourne le nombre recréé.
 */
export async function reattachLocalFriends(max = 50): Promise<number> {
  const codes = readFriends()
    .map(f => f.snapshot.code)
    .filter((c): c is string => typeof c === 'string')
    .slice(0, max);
  let done = 0;
  for (const code of codes) {
    if (await addFriendByCode(code).catch(() => null)) done += 1;
  }
  return done;
}

/** Récupère les amis du compte et rafraîchit leurs cartes locales. */
export async function refreshFriends(uid: string): Promise<number> {
  const sb = cloud();
  if (!sb) return 0;
  const { data: links, error } = await sb.from('friendships').select('friend_id').eq('user_id', uid).limit(500);
  if (error || !links?.length) return 0;
  const ids = links.map(l => l.friend_id as string);
  const { data: rows } = await sb.from('profiles').select('id, name, avatar_id, avatar_bg, card').in('id', ids);
  const cards = (rows ?? []).map(r => cardFromProfile(r as ProfileRow)).filter((c): c is FriendSnapshot => Boolean(c));
  // Les cartes serveur sont la référence : on remplace celles des amis du compte, on garde les amis « lien » locaux.
  const serverIds = new Set(cards.map(c => c.id));
  const localOnly = readFriends().filter(f => !serverIds.has(f.snapshot.id));
  const existing = new Map(readFriends().map(f => [f.snapshot.id, f.addedAt]));
  writeJson(FRIENDS_KEY, [...localOnly, ...cards.map(snapshot => ({ snapshot, addedAt: existing.get(snapshot.id) ?? Date.now() }))]);
  return cards.length;
}

export async function removeFriendCloud(friendId: string): Promise<void> {
  const sb = cloud();
  if (!sb || !/^[0-9a-f]{32}$/.test(friendId)) return;
  const uuid = `${friendId.slice(0, 8)}-${friendId.slice(8, 12)}-${friendId.slice(12, 16)}-${friendId.slice(16, 20)}-${friendId.slice(20)}`;
  await sb.rpc('remove_friend', { friend: uuid });
}

// ═════════════════════════ Sessions de groupe ═════════════════════════

interface VoteRow {
  user_id: string;
  name: string;
  likes: string[];
  at: string;
}

const toVote = (r: VoteRow): GroupVote => ({ voterId: r.user_id.replace(/-/g, ''), name: r.name, likes: r.likes ?? [], at: Date.parse(r.at) || 0 });

/** Publie (ou rejoint) la session et y enregistre le vote de l'utilisateur. */
export async function syncGroup(session: GroupSession, uid: string, myVote?: GroupVote): Promise<GroupSession> {
  const sb = cloud();
  if (!sb) return session;
  // Création si on est l'hôte ; sinon la session existe déjà (lien reçu).
  if (session.host.id === uid.replace(/-/g, '')) {
    await sb.from('groups').upsert({ id: session.id, host: uid, title: session.title, restos: session.restos }, { onConflict: 'id', ignoreDuplicates: true });
  }
  await sb.from('group_members').upsert({ group_id: session.id, user_id: uid }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
  if (myVote) {
    await sb.from('group_votes').upsert({ group_id: session.id, user_id: uid, name: myVote.name, likes: myVote.likes, at: new Date(myVote.at).toISOString() });
  }
  return pullGroupVotes(session);
}

export async function pullGroupVotes(session: GroupSession): Promise<GroupSession> {
  const sb = cloud();
  if (!sb) return session;
  const { data } = await sb.from('group_votes').select('user_id, name, likes, at').eq('group_id', session.id).limit(12);
  if (!data) return session;
  const merged = mergeGroups(findGroup(session.id) ?? session, { ...session, votes: (data as VoteRow[]).map(toVote) });
  saveGroup(merged);
  return merged;
}

/** Votes en direct : appelle onChange à chaque nouveau vote du groupe. */
export function watchGroup(groupId: string, onChange: () => void): () => void {
  const sb = cloud();
  if (!sb) return () => undefined;
  const channel: RealtimeChannel = sb
    .channel(`group-${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_votes', filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

// ═════════════════════════ Posts et vraies photos ═════════════════════════

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Publie un post sur le compte (photo comprise). Retourne false en cas d'échec : le post reste local. */
export async function publishCloudPost(post: FeedPost, uid: string): Promise<boolean> {
  const sb = cloud();
  if (!sb) return false;
  let photoPath: string | null = null;
  if (post.photo?.startsWith('data:image/')) {
    const blob = await dataUrlToBlob(post.photo);
    if (blob.size > 1_500_000) return false;
    photoPath = `${uid}/${post.id}.jpg`;
    const up = await sb.storage.from(PHOTO_BUCKET).upload(photoPath, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) return false;
  }
  const { error } = await sb.from('posts').insert({
    id: post.id,
    user_id: uid,
    restaurant_id: post.restaurantId.slice(0, 40),
    restaurant_name: post.restaurantName.slice(0, 60),
    cuisine: post.cuisine.slice(0, 40),
    verdict: post.verdict,
    caption: post.caption.slice(0, 140),
    photo_path: photoPath,
  });
  return !error;
}

interface PostRow {
  id: string;
  user_id: string;
  restaurant_id: string;
  restaurant_name: string;
  cuisine: string;
  verdict: Verdict;
  caption: string;
  photo_path: string | null;
  created_at: string;
}

interface AuthorRow {
  id: string;
  name: string;
  avatar_id: string;
  avatar_bg: string;
  level: number;
}

/** Derniers posts publics (fil de la ville). */
export async function fetchCloudPosts(myUid: string | null, limit = 40): Promise<FeedPost[]> {
  const sb = cloud();
  if (!sb) return [];
  const { data: posts } = await sb
    .from('posts')
    .select('id, user_id, restaurant_id, restaurant_name, cuisine, verdict, caption, photo_path, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!posts?.length) return [];
  const authorIds = Array.from(new Set((posts as PostRow[]).map(p => p.user_id)));
  const { data: authors } = await sb.from('post_authors').select('id, name, avatar_id, avatar_bg, level').in('id', authorIds);
  const byId = new Map(((authors ?? []) as AuthorRow[]).map(a => [a.id, a]));
  return (posts as PostRow[]).map(p => {
    const a = byId.get(p.user_id);
    return {
      id: p.id,
      author: { name: a?.name ?? 'foodie', avatar: { id: a?.avatar_id ?? 'burger', bg: a?.avatar_bg ?? 'bubblegum' }, level: a?.level ?? 1 },
      restaurantId: p.restaurant_id,
      restaurantName: p.restaurant_name,
      cuisine: p.cuisine,
      sticker: stickerFor(p.cuisine, p.restaurant_id, p.restaurant_name) as StickerName,
      caption: p.caption,
      verdict: p.verdict,
      photo: p.photo_path ? photoUrl(p.photo_path) : undefined,
      likes: 0,
      createdAt: Date.parse(p.created_at) || Date.now(),
      mine: myUid !== null && p.user_id === myUid,
    };
  });
}

export async function deleteCloudPost(postId: string): Promise<void> {
  const sb = cloud();
  if (!sb) return;
  const { data } = await sb.from('posts').select('photo_path').eq('id', postId).maybeSingle();
  if (data?.photo_path) await sb.storage.from(PHOTO_BUCKET).remove([data.photo_path]);
  await sb.from('posts').delete().eq('id', postId);
}

/** Vraies photos de la communauté pour une liste de restos (une requête pour tout le deck). */
export async function fetchRestaurantPhotos(restaurantIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const sb = cloud();
  if (!sb || restaurantIds.length === 0) return out;
  const { data } = await sb
    .from('posts')
    .select('restaurant_id, photo_path')
    .in('restaurant_id', restaurantIds.slice(0, 200))
    .not('photo_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(400);
  for (const row of (data ?? []) as { restaurant_id: string; photo_path: string }[]) {
    out.set(row.restaurant_id, [...(out.get(row.restaurant_id) ?? []), photoUrl(row.photo_path)]);
  }
  return out;
}

export async function reportPost(postId: string, uid: string, reason: string): Promise<boolean> {
  const sb = cloud();
  if (!sb) return false;
  const { error } = await sb.from('reports').insert({ post_id: postId, reporter: uid, reason: reason.slice(0, 200) });
  return !error;
}

/** Suppression définitive du compte : photos, puis compte (les tables suivent en cascade). */
export async function deleteAccount(uid: string): Promise<boolean> {
  const sb = cloud();
  if (!sb) return false;
  const { data: files } = await sb.storage.from(PHOTO_BUCKET).list(uid, { limit: 1000 });
  if (files?.length) await sb.storage.from(PHOTO_BUCKET).remove(files.map(f => `${uid}/${f.name}`));
  const { error } = await sb.rpc('delete_me');
  if (error) return false;
  await sb.auth.signOut();
  return true;
}
