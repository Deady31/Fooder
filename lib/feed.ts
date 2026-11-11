import { AvatarChoice } from './avatars';
import { StickerName } from './stickers';

export interface FeedAuthor {
  name: string;
  avatar: AvatarChoice;
  level: number;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  restaurantId: string;
  restaurantName: string;
  cuisine: string;
  sticker: StickerName;
  caption: string;
  /** Photo recompressée (data URL) : uniquement pour les posts de l'utilisateur en mode local */
  photo?: string;
  likes: number;
  createdAt: number;
  mine?: boolean;
}

export const MAX_CAPTION = 140;
export const POSTS_KEY = 'fooder_posts';
export const POST_LIKES_KEY = 'fooder_post_likes';

const HOUR = 3_600_000;

/** Exemples fictifs affichés tant que les comptes n'existent pas (marqués « démo » dans l'interface). */
export function seedPosts(now: number = Date.now()): FeedPost[] {
  return [
    { id: 'seed-1', author: { name: 'lea_mange', avatar: { id: 'donut', bg: 'bubblegum' }, level: 6 }, restaurantId: '1', restaurantName: 'Michel Sarran', cuisine: 'Gastronomique', sticker: 'plate', caption: 'Le menu Capitole du midi, rapport qualité/prix imbattable.', likes: 42, createdAt: now - 1 * HOUR },
    { id: 'seed-2', author: { name: 'tom.bao', avatar: { id: 'ramen', bg: 'lemon' }, level: 3 }, restaurantId: 'seed-r2', restaurantName: 'Ramen du Capitole', cuisine: 'Japonais', sticker: 'ramen', caption: 'Bouillon parfait pour un jour de pluie.', likes: 18, createdAt: now - 3 * HOUR },
    { id: 'seed-3', author: { name: 'sarah_swipe', avatar: { id: 'boba', bg: 'mint' }, level: 9 }, restaurantId: 'seed-r3', restaurantName: 'Boba Garden', cuisine: 'Café', sticker: 'boba', caption: 'Spot parfait pour réviser, wifi ok.', likes: 27, createdAt: now - 7 * HOUR },
    { id: 'seed-4', author: { name: 'yanis31', avatar: { id: 'burger', bg: 'orange' }, level: 4 }, restaurantId: 'seed-r4', restaurantName: 'Burger de Compans', cuisine: 'Burger', sticker: 'burger', caption: 'Frites maison, sauce secrète. Je reviens.', likes: 11, createdAt: now - 20 * HOUR },
  ];
}

export function timeAgo(ts: number, now: number = Date.now()): string {
  const min = Math.max(1, Math.round((now - ts) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Recompresse une photo côté client : redimensionne et supprime les métadonnées EXIF (dont le GPS). */
export function compressImage(file: File, maxSide = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Fichier non pris en charge'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas indisponible'));
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}
