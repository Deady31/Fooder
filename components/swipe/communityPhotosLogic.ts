import type { Restaurant } from '../../data/mockRestaurants';
import { DEFAULT_AVATAR } from '../../lib/avatars';
import type { CommunityPhotoPost } from '../../lib/cloud/social';
import { isCloudPostId, miamCount } from '../feed/feedLogic';

/** Logique pure de la section « Photos de la communauté » (aucune dépendance au DOM) : tests/communityPhotos.test.ts. */

const heartsOf = (p: Pick<CommunityPhotoPost, 'likes'>): number => (Number.isFinite(p.likes) && p.likes > 0 ? Math.floor(p.likes) : 0);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Mes posts locaux de ce resto qui portent une photo, au format commun (jamais aimables : ce sont les miens). */
export function localPhotoPosts(raw: unknown, restaurantId: string): CommunityPhotoPost[] {
  if (!Array.isArray(raw)) return [];
  const out: CommunityPhotoPost[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const { id, restaurantId: rid, photo, createdAt, author } = item;
    if (typeof id !== 'string' || rid !== restaurantId || typeof photo !== 'string' || photo === '') continue;
    const a = isRecord(author) ? author : null;
    const av = a && isRecord(a.avatar) ? a.avatar : null;
    out.push({
      postId: id,
      url: photo,
      likes: 0,
      createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0,
      author: {
        name: a && typeof a.name === 'string' && a.name ? a.name : 'Toi',
        avatar: {
          id: av && typeof av.id === 'string' ? av.id : DEFAULT_AVATAR.id,
          bg: av && typeof av.bg === 'string' ? av.bg : DEFAULT_AVATAR.bg,
        },
      },
      mine: true,
      likedByMe: false,
    });
  }
  return out;
}

/**
 * Fusionne mes photos locales et celles du serveur : un même post (même id) n'apparaît qu'une fois
 * (l'URL et les cœurs du serveur gagnent, il reste « à moi »). Tri : plus de cœurs d'abord, puis plus récent.
 * Ne modifie pas les listes reçues ; les photos sans URL sont ignorées.
 */
export function mergeCommunityPosts(local: CommunityPhotoPost[], cloud: CommunityPhotoPost[]): CommunityPhotoPost[] {
  const byId = new Map<string, CommunityPhotoPost>();
  for (const p of local) byId.set(p.postId, p);
  for (const p of cloud) {
    const mine = p.mine || byId.get(p.postId)?.mine === true;
    byId.set(p.postId, { ...p, mine });
  }
  return Array.from(byId.values())
    .filter(p => p.url !== '')
    .sort((a, b) => heartsOf(b) - heartsOf(a) || (b.createdAt || 0) - (a.createdAt || 0));
}

/** On ne donne un cœur qu'à la photo d'un autre, déjà publiée en ligne. */
export function canLike(p: Pick<CommunityPhotoPost, 'postId' | 'mine'>): boolean {
  return !p.mine && isCloudPostId(p.postId);
}

/** Cœurs affichés : le total serveur contient déjà mon cœur s'il existait au chargement (`likedByMe`). */
export function displayLikes(p: Pick<CommunityPhotoPost, 'likes' | 'likedByMe'>, liked: boolean): number {
  return miamCount(p.likes, liked, p.likedByMe);
}

/** Copie de l'ensemble avec `id` ajouté ou retiré (sert à l'état optimiste ET au retour arrière). */
export function toggleSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Post dont la photo est celle affichée sur la carte du resto (null si la carte n'affiche pas une photo de la communauté). */
export function cardPhotoPostId(
  entries: readonly CommunityPhotoPost[],
  rest: Partial<Pick<Restaurant, 'image' | 'photoSource'>>
): string | null {
  if (rest.photoSource !== 'community' || !rest.image) return null;
  return entries.find(e => e.url === rest.image)?.postId ?? null;
}

export function heartsLabel(n: number): string {
  if (!(n > 0)) return 'Aucun cœur';
  return n === 1 ? '1 cœur' : `${n} cœurs`;
}

/** « Toi » pour mes photos, le pseudo sinon, null si l'auteur est inconnu (on n'invente rien). */
export function authorLabel(p: Pick<CommunityPhotoPost, 'mine' | 'author'>): string | null {
  if (p.mine) return 'Toi';
  return p.author?.name || null;
}

export function photoAlt(p: Pick<CommunityPhotoPost, 'mine' | 'author'>, restaurantName: string, index: number, total: number): string {
  const who = authorLabel(p);
  return `Photo ${index + 1} sur ${total} de la communauté, chez ${restaurantName}${who && !p.mine ? `, par ${who}` : ''}`;
}

/** Ligne affichée sous la photo agrandie : « 12 ♥ · photo de @pseudo », « Ta photo », ou rien. */
export function viewerLine(p: Pick<CommunityPhotoPost, 'mine' | 'author'>, likes: number): string | null {
  const parts = [
    likes > 0 ? `${Math.floor(likes)} ♥` : null,
    p.mine ? 'Ta photo' : p.author?.name ? `photo de @${p.author.name}` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}
