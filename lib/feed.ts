import { AvatarChoice } from './avatars';
import { StickerName } from './stickers';
import { PHOTO_ALLOWED_MIME, PHOTO_MAX_BYTES, estimateDataUrlBytes } from './cloud/photoUpload';

export interface FeedAuthor {
  name: string;
  avatar: AvatarChoice;
  level: number;
}

export type Verdict = 'miam' | 'bof' | 'atester';

export const VERDICTS: { id: Verdict; label: string; color: string }[] = [
  { id: 'miam', label: 'MIAM', color: '#12B76A' },
  { id: 'atester', label: 'À TESTER', color: '#6C2BFF' },
  { id: 'bof', label: 'BOF', color: '#F04438' },
];

export interface FeedComment {
  id: string;
  postId: string;
  authorName: string;
  /** Mascotte de l'auteur, enregistrée à la création (absente des anciens commentaires). */
  avatar?: AvatarChoice;
  text: string;
  createdAt: number;
  mine?: boolean;
}

export const COMMENTS_KEY = 'fooder_comments';
export const MAX_COMMENT = 140;

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  restaurantId: string;
  restaurantName: string;
  cuisine: string;
  sticker: StickerName;
  caption: string;
  verdict: Verdict;
  /** Photo recompressée (data URL) : uniquement pour les posts de l'utilisateur en mode local */
  photo?: string;
  likes: number;
  createdAt: number;
  mine?: boolean;
  /** Identifiant du compte auteur (32 caractères hexadécimaux), connu pour les posts en ligne : sert au filtre « Amis ». */
  authorId?: string;
}

export const MAX_CAPTION = 140;
export const POSTS_KEY = 'fooder_posts';
export const POST_LIKES_KEY = 'fooder_post_likes';

const HOUR = 3_600_000;

/** Exemples fictifs affichés tant que les comptes n'existent pas (marqués « démo » dans l'interface). */
export function seedPosts(now: number = Date.now()): FeedPost[] {
  return [
    { id: 'seed-1', verdict: 'miam', author: { name: 'lea_mange', avatar: { id: 'donut', bg: 'bubblegum' }, level: 6 }, restaurantId: '1', restaurantName: 'Michel Sarran', cuisine: 'Gastronomique', sticker: 'plate', caption: 'Le menu Capitole du midi, rapport qualité/prix imbattable.', likes: 42, createdAt: now - 1 * HOUR },
    { id: 'seed-2', verdict: 'miam', author: { name: 'tom.bao', avatar: { id: 'ramen', bg: 'lemon' }, level: 3 }, restaurantId: 'seed-r2', restaurantName: 'Ramen du Capitole', cuisine: 'Japonais', sticker: 'ramen', caption: 'Bouillon parfait pour un jour de pluie.', likes: 18, createdAt: now - 3 * HOUR },
    { id: 'seed-3', verdict: 'atester', author: { name: 'sarah_swipe', avatar: { id: 'boba', bg: 'mint' }, level: 9 }, restaurantId: 'seed-r3', restaurantName: 'Boba Garden', cuisine: 'Café', sticker: 'boba', caption: 'Spot parfait pour réviser, wifi ok.', likes: 27, createdAt: now - 7 * HOUR },
    { id: 'seed-4', verdict: 'miam', author: { name: 'yanis31', avatar: { id: 'burger', bg: 'orange' }, level: 4 }, restaurantId: 'seed-r4', restaurantName: 'Burger de Compans', cuisine: 'Burger', sticker: 'burger', caption: 'Frites maison, sauce secrète. Je reviens.', likes: 11, createdAt: now - 20 * HOUR },
  ];
}

export function timeAgo(ts: number, now: number = Date.now()): string {
  const min = Math.max(1, Math.round((now - ts) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Encode (mime, qualité, échelle) => data URL. Un navigateur sans encodeur pour `mime` renvoie du PNG. */
export type PhotoEncoder = (mime: string, quality: number, scale: number) => string;

/**
 * Choisit un encodage accepté par le serveur (JPEG, sinon WebP ; jamais PNG) et sous la limite de poids du bucket,
 * en baissant qualité puis taille si besoin. null si aucun encodage ne convient.
 */
export function encodeWithinLimits(encode: PhotoEncoder, quality: number): string | null {
  const qualities = Array.from(new Set([quality, 0.6, 0.5, 0.4])).filter(q => q <= quality);
  for (const mime of PHOTO_ALLOWED_MIME) {
    const first = encode(mime, quality, 1);
    if (!first.startsWith(`data:${mime}`)) continue; // encodeur absent : repli PNG refusé par le bucket
    if (estimateDataUrlBytes(first) <= PHOTO_MAX_BYTES) return first;
    for (const scale of [1, 0.75, 0.5]) {
      for (const q of qualities) {
        const out = encode(mime, q, scale);
        if (out.startsWith(`data:${mime}`) && estimateDataUrlBytes(out) <= PHOTO_MAX_BYTES) return out;
      }
    }
  }
  return null;
}

/** Recompresse une photo côté client : redimensionne et supprime les métadonnées EXIF (dont le GPS). */
export function compressImage(file: File, maxSide = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    // Certains Android ne renseignent pas file.type pour une photo prise à l'instant : on laisse le décodeur trancher.
    if (file.type && !file.type.startsWith('image/')) return reject(new Error('Fichier non pris en charge'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const base = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas indisponible'));
      }
      const encode: PhotoEncoder = (mime, q, scale) => {
        canvas.width = Math.max(1, Math.round(img.width * base * scale));
        canvas.height = Math.max(1, Math.round(img.height * base * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL(mime, q);
      };
      const out = encodeWithinLimits(encode, quality);
      URL.revokeObjectURL(url);
      if (!out) return reject(new Error('Format non pris en charge'));
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

export function seedComments(now: number = Date.now()): FeedComment[] {
  return [
    { id: 'sc-1', postId: 'seed-1', authorName: 'tom.bao', text: "Noté ! Il faut réserver longtemps à l'avance ?", createdAt: now - 40 * 60_000 },
    { id: 'sc-2', postId: 'seed-1', authorName: 'lea_mange', text: 'Une semaine pour le midi, ça passe.', createdAt: now - 25 * 60_000 },
    { id: 'sc-3', postId: 'seed-3', authorName: 'yanis31', text: 'Les prises sont où ?', createdAt: now - 5 * HOUR },
  ];
}
