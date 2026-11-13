import type { Restaurant } from '../data/mockRestaurants';
import { photoCreditLine } from '../components/ui/lightboxMath';

export type PhotoSource = NonNullable<Restaurant['photoSource']>;

/**
 * Priorité d'affichage de la CARTE : communauté (vrai plat d'un foodie) > plat typique > illustration (aucune source).
 * Google vaut 0 : jamais image principale de la carte (il n'apparaît que dans la fiche, à la demande).
 */
const RANK: Record<PhotoSource, number> = { community: 3, dish: 1, google: 0 };

export function photoRank(source: Restaurant['photoSource'] | undefined): number {
  return source ? RANK[source] : 0;
}

export interface PhotoCandidate {
  source: PhotoSource;
  images: string[];
  credit?: string;
  license?: string;
  page?: string;
}

/**
 * Applique une photo candidate seulement si sa source est strictement plus prioritaire que l'actuelle.
 * Pure : renvoie la même fiche si rien ne change, sinon une copie (les métadonnées de crédit de l'ancienne source sont retirées).
 */
export function withBetterPhoto<T extends Restaurant>(rest: T, candidate: PhotoCandidate): T {
  const images = candidate.images.filter(Boolean);
  if (images.length === 0 || photoRank(candidate.source) <= photoRank(rest.photoSource)) return rest;
  const { photoCredit: _c, photoLicense: _l, photoPage: _p, ...clean } = rest;
  return {
    ...clean,
    image: images[0],
    extraImages: images.slice(1),
    photoSource: candidate.source,
    ...(candidate.credit ? { photoCredit: candidate.credit } : {}),
    ...(candidate.license ? { photoLicense: candidate.license } : {}),
    ...(candidate.page ? { photoPage: candidate.page } : {}),
  } as T;
}

/** Photo communautaire avec ses cœurs (le post d'origine porte les cœurs). */
export interface CommunityPhoto {
  postId: string;
  url: string;
  likes: number;
  createdAt: number;
  author?: string;
}

const heartsOf = (p: CommunityPhoto): number => (Number.isFinite(p.likes) && p.likes > 0 ? p.likes : 0);

/** La plus aimée d'abord ; à égalité, la plus récente. Pure : ne modifie pas la liste reçue. */
export function rankCommunityPhotos(photos: CommunityPhoto[]): CommunityPhoto[] {
  return [...photos].sort((a, b) => heartsOf(b) - heartsOf(a) || (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Ordre final des photos communautaires d'un resto (la première devient l'image de la carte) :
 * photos aimées du serveur, puis mes photos locales, puis les autres photos du serveur (plus récentes d'abord).
 */
export function mergeCommunityPhotos(local: string[], cloud: CommunityPhoto[]): string[] {
  const ranked = rankCommunityPhotos(cloud);
  const liked = ranked.filter(p => heartsOf(p) > 0).map(p => p.url);
  const unliked = ranked.filter(p => heartsOf(p) === 0).map(p => p.url);
  return Array.from(new Set([...liked, ...local, ...unliked].filter(Boolean)));
}

/** « 12 ♥ · photo de @pseudo » sous la photo affichée ; null si aucune donnée n'existe. */
export function photoLikesLine(photo: Pick<CommunityPhoto, 'likes' | 'author'>): string | null {
  const parts = [
    heartsOf(photo as CommunityPhoto) > 0 ? `${Math.floor(photo.likes)} ♥` : null,
    photo.author ? `photo de @${photo.author}` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Galerie de la fiche : photos des foodies, puis plat typique (jamais une illustration ni une image Google). */
export function galleryFor(rest: Restaurant, community: string[]): string[] {
  const main = (rest.photoSource === 'community' || rest.photoSource === 'dish') && rest.image ? [rest.image] : [];
  return Array.from(new Set([...community, ...main, ...(rest.extraImages ?? [])].filter(Boolean)));
}

/** Crédit affiché dans la visionneuse pour l'image `src` (null = aucun : communauté ou illustration). */
export function viewerCredit(
  rest: Restaurant,
  src: string | undefined,
  community: string[],
  google: { url: string; author?: string } | null,
): string | null {
  if (!src) return null;
  if (google && src === google.url) return photoCreditLine('google', google.author);
  if (community.includes(src)) return null;
  if (src === rest.image) return photoCreditLine(rest.photoSource, rest.photoCredit, rest.photoLicense);
  return null;
}
