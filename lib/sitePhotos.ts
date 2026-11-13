import consentTable from '../data/photo-consent.json';
import photoTable from '../data/photos-consented.json';

export const RESTAURANT_PHOTO_CREDIT = 'Photo fournie par le restaurant';

export type RestaurantPhotoKind = 'dish' | 'site';

export interface RestaurantPhoto {
  /** Chemin servi par l'app, ex. /restos/osm-n123.jpg */
  src: string;
  /** 'dish' = plat envoyé par le restaurateur ; 'site' = photo de son site (peut être un visuel de marque) */
  kind: RestaurantPhotoKind;
  credit: string;
  consentedAt: string;
}

interface ConsentFile {
  restaurants?: Record<string, unknown>;
}

/**
 * Photo affichable d'un restaurant : UNIQUEMENT si son id figure dans le fichier de consentement ET qu'une photo
 * valide existe. Refus par défaut ; retirer le consentement = supprimer l'entrée de data/photo-consent.json.
 */
export function consentedPhotoFor(
  id: string,
  photos: Record<string, Partial<RestaurantPhoto>>,
  consent: ConsentFile,
): RestaurantPhoto | null {
  if (!consent?.restaurants || !Object.prototype.hasOwnProperty.call(consent.restaurants, id)) return null;
  const p = photos?.[id];
  if (!p || typeof p.src !== 'string' || !p.src || (p.kind !== 'dish' && p.kind !== 'site')) return null;
  return {
    src: p.src,
    kind: p.kind,
    credit: p.credit || RESTAURANT_PHOTO_CREDIT,
    consentedAt: p.consentedAt ?? '',
  };
}

/** Photo consentie du restaurant `id` (null si pas d'accord). Voir docs/PHOTOS.md. */
export function restaurantPhoto(id: string): RestaurantPhoto | null {
  return consentedPhotoFor(id, photoTable as Record<string, Partial<RestaurantPhoto>>, consentTable as ConsentFile);
}
