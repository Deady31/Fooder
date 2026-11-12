import type { Restaurant } from '../data/mockRestaurants';

export type PhotoSource = NonNullable<Restaurant['photoSource']>;

/** Priorité d'affichage : communauté (photo d'un foodie) > Google > plat typique > illustration (aucune source). */
const RANK: Record<PhotoSource, number> = { community: 3, google: 2, dish: 1 };

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

/** Galerie de la fiche : photos des foodies d'abord, puis photo principale réelle (jamais une illustration), puis les autres. */
export function galleryFor(rest: Restaurant, community: string[]): string[] {
  const main = rest.photoSource && rest.image ? [rest.image] : [];
  return Array.from(new Set([...community, ...main, ...(rest.extraImages ?? [])].filter(Boolean)));
}
