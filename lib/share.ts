import { FeedPost, POSTS_KEY } from './feed';
import { readJson, writeJson } from './store';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Partage natif (WhatsApp, SMS…) ou copie du lien en repli. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Partage une image (carte de visite) ; télécharge le fichier si le partage de fichiers n'est pas disponible. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'copied';
}

/** Publie un post local dans le fil (hors du hook useFeed). */
export function publishPost(post: FeedPost): boolean {
  const mine = readJson<FeedPost[]>(POSTS_KEY, []);
  return writeJson(POSTS_KEY, [post, ...mine]);
}

export function outcomeLabel(o: ShareOutcome): string | null {
  if (o === 'copied') return 'Lien copié, colle-le dans ta conversation';
  if (o === 'failed') return 'Partage impossible sur cet appareil';
  return null;
}
