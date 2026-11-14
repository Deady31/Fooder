import consentTable from '../data/photo-consent.json';
import photoTable from '../data/photos-consented.json';
import blocklistTable from '../data/photo-blocklist.json';

export const RESTAURANT_PHOTO_CREDIT = 'Photo fournie par le restaurant';

export type RestaurantPhotoKind = 'dish' | 'site';

export interface RestaurantPhoto {
  /** Chemin servi par l'app, ex. /restos/osm-n123.webp */
  src: string;
  /** 'dish' = plat envoyé par le restaurateur ; 'site' = photo de son site (peut être un visuel de marque) */
  kind: RestaurantPhotoKind;
  credit: string;
  consentedAt: string;
}

export interface ConsentFile {
  /** Accord général (ex. toute la zone Grand Toulouse) : actif => toute photo est affichable sauf retrait/blocage. */
  blanket?: { active?: boolean; scope?: string };
  /** Accords individuels (id OSM -> détail). */
  restaurants?: Record<string, unknown>;
  /** Restaurants qui ont retiré leur accord : jamais affichés, quoi qu'il arrive. */
  revoked?: string[];
}

export interface BlocklistFile {
  /** Photos écartées pour qualité (logo, bannière, capture...) : id -> raison. */
  blocked?: Record<string, unknown>;
}

const has = (o: object | undefined, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/**
 * Photo affichable d'un restaurant :
 *   (id dans la liste explicite OU accord général actif) ET id pas dans `revoked` ET id pas dans la blocklist qualité
 *   ET une photo valide existe. Retrait d'un restaurant : node scripts/block-photo.mjs <id> --revoke.
 */
export function consentedPhotoFor(
  id: string,
  photos: Record<string, Partial<RestaurantPhoto>>,
  consent: ConsentFile,
  blocklist: BlocklistFile = {},
): RestaurantPhoto | null {
  if (!consent) return null;
  if (Array.isArray(consent.revoked) && consent.revoked.includes(id)) return null;
  if (has(blocklist?.blocked, id)) return null;
  const allowed = consent.blanket?.active === true || has(consent.restaurants, id);
  if (!allowed) return null;
  const p = photos?.[id];
  if (!p || typeof p.src !== 'string' || !p.src || (p.kind !== 'dish' && p.kind !== 'site')) return null;
  return {
    src: p.src,
    kind: p.kind,
    credit: p.credit || RESTAURANT_PHOTO_CREDIT,
    consentedAt: p.consentedAt ?? '',
  };
}

/** Photo consentie du restaurant `id` (null si pas d'accord, retrait ou blocage qualité). Voir docs/PHOTOS.md. */
export function restaurantPhoto(id: string): RestaurantPhoto | null {
  return consentedPhotoFor(
    id,
    photoTable as Record<string, Partial<RestaurantPhoto>>,
    consentTable as ConsentFile,
    blocklistTable as BlocklistFile,
  );
}
