import { AVATARS, AVATAR_BACKGROUNDS, AvatarChoice, DEFAULT_AVATAR } from '../../lib/avatars';
import type { FeedComment } from '../../lib/feed';

/** Identité affichée d'un commentaire : logique pure (testée dans tests/commentAuthor.test.ts). */

export interface CommentIdentity {
  name: string;
  /** Mascotte validée, ou null pour un ancien commentaire (repli : initiale sur fond de marque). */
  avatar: AvatarChoice | null;
  initial: string;
}

function validAvatar(raw: unknown): AvatarChoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, bg } = raw as { id?: unknown; bg?: unknown };
  // Seuls les ids connus : l'id sert à construire un chemin d'image.
  if (typeof id !== 'string' || !AVATARS.some(a => a.id === id)) return null;
  const known = typeof bg === 'string' && AVATAR_BACKGROUNDS.some(b => b.id === bg);
  return { id, bg: known ? (bg as string) : DEFAULT_AVATAR.bg };
}

export function commentIdentity(c: Pick<FeedComment, 'authorName' | 'avatar'>): CommentIdentity {
  const name = typeof c.authorName === 'string' ? c.authorName.trim() : '';
  const first = Array.from(name)[0];
  return {
    name: name || 'Anonyme',
    avatar: validAvatar(c.avatar),
    initial: first ? first.toLocaleUpperCase('fr') : '?',
  };
}
