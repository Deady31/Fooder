import { FeedComment, MAX_COMMENT } from '../../lib/feed';

/** Commentaire tel que stocké : `editedAt` apparaît après une modification (synchronisé via fooder_comments). */
export type StoredComment = FeedComment & { editedAt?: number };

export interface EditFailure {
  ok: false;
  reason: 'not_found' | 'forbidden' | 'empty' | 'unchanged';
}
export type EditResult = { ok: true; comments: StoredComment[] } | EditFailure;

/** Mêmes règles qu'à la création : texte rogné, plafonné à MAX_COMMENT. */
export function cleanCommentText(text: string): string {
  return typeof text === 'string' ? text.trim().slice(0, MAX_COMMENT) : '';
}

/** Seul l'auteur modifie : les commentaires de démonstration et ceux des autres n'ont pas `mine`. */
export function canEditComment(c: Pick<FeedComment, 'mine'>): boolean {
  return c.mine === true;
}

/**
 * Modifie le texte d'un commentaire sans toucher à son id ni à sa date de création, sans muter la liste.
 * Ne donne ni XP ni notification (fonction pure : aucun effet).
 */
export function editComment(list: readonly StoredComment[], id: string, text: string, now: number = Date.now()): EditResult {
  if (!Array.isArray(list)) return { ok: false, reason: 'not_found' };
  const current = list.find(c => c.id === id);
  if (!current) return { ok: false, reason: 'not_found' };
  if (!canEditComment(current)) return { ok: false, reason: 'forbidden' };
  const clean = cleanCommentText(text);
  if (!clean) return { ok: false, reason: 'empty' };
  if (clean === current.text) return { ok: false, reason: 'unchanged' };
  return { ok: true, comments: list.map(c => (c.id === id ? { ...c, text: clean, editedAt: now } : c)) };
}

/** « modifié à 14:32 » ; null si le commentaire n'a jamais été modifié. */
export function editedLabel(editedAt: number | undefined): string | null {
  if (typeof editedAt !== 'number' || !Number.isFinite(editedAt)) return null;
  const d = new Date(editedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `modifié à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
