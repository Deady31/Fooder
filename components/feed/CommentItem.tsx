'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_COMMENT, timeAgo } from '../../lib/feed';
import { CommentAvatar } from './CommentAvatar';
import { commentIdentity } from './commentAuthor';
import { EditFailure, EditResult, StoredComment, canEditComment, editedLabel } from './commentEdit';

interface CommentItemProps {
  comment: StoredComment;
  onEdit: (commentId: string, text: string) => EditResult;
}

const REASON_TEXT: Record<EditFailure['reason'], string> = {
  empty: 'Le commentaire ne peut pas être vide.',
  unchanged: '',
  forbidden: 'Tu ne peux modifier que tes propres commentaires.',
  not_found: 'Impossible d’enregistrer la modification.',
};

/** Un commentaire ; son auteur peut le modifier sur place (Enregistrer / Annuler, Entrée / Échap). */
export function CommentItem({ comment: c, onEdit }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Focus : champ à l'ouverture, bouton « Modifier » au retour.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (wasEditing.current) editBtnRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const start = () => {
    setDraft(c.text);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setAnnounce('Modification annulée.');
  };

  const save = () => {
    const result = onEdit(c.id, draft);
    if (result.ok) {
      setEditing(false);
      setError(null);
      setAnnounce('Commentaire modifié.');
      return;
    }
    const { reason } = result as EditFailure;
    if (reason === 'unchanged') {
      cancel();
      return;
    }
    setError(REASON_TEXT[reason]);
    setAnnounce(REASON_TEXT[reason]);
    inputRef.current?.focus();
  };

  const edited = editedLabel(c.editedAt);
  const who = commentIdentity(c);

  return (
    <li className='flex items-start gap-2 text-sm leading-snug break-words'>
      <CommentAvatar identity={who} />
      <div className='min-w-0 flex-1'>
      <span role='status' aria-live='polite' className='sr-only'>{announce}</span>
      {editing ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            save();
          }}
          className='space-y-1.5'
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            maxLength={MAX_COMMENT}
            aria-label='Modifier ton commentaire'
            aria-invalid={error ? true : undefined}
            className='w-full rounded-full border-[3px] border-plum bg-white px-4 py-2 text-base font-medium text-plum outline-none focus:shadow-hard-sm'
          />
          {error && <p role='alert' className='text-xs font-bold text-danger'>{error}</p>}
          <div className='flex gap-2'>
            <button type='submit' className='min-h-[44px] px-4 rounded-full border-[3px] border-plum bg-bubblegum text-xs font-bold text-plum active:translate-y-0.5'>
              Enregistrer
            </button>
            <button type='button' onClick={cancel} className='min-h-[44px] px-4 rounded-full border-[3px] border-plum bg-white text-xs font-bold text-plum active:translate-y-0.5'>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className='font-bold text-plum'>{who.name}</span>{' '}
          <span className='font-medium text-plum'>{c.text}</span>
          <span className='text-[10px] font-bold text-plum-muted'> · {timeAgo(c.createdAt)}{edited ? ` · ${edited}` : ''}</span>
          {canEditComment(c) && (
            <button
              ref={editBtnRef}
              onClick={start}
              aria-label={`Modifier mon commentaire : ${c.text.slice(0, 30)}`}
              className='ml-1 min-h-[44px] min-w-[44px] px-2 text-[11px] font-bold text-plum-muted underline'
            >
              Modifier
            </button>
          )}
        </>
      )}
      </div>
    </li>
  );
}
