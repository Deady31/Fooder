import { describe, expect, it } from 'vitest';
import { canEditComment, cleanCommentText, editComment, editedLabel, type StoredComment } from '../components/feed/commentEdit';
import { MAX_COMMENT } from '../lib/feed';
import { mergeKey } from '../lib/cloud/merge';

const NOW = 1_800_000_000_000;
const c = (over: Partial<StoredComment> = {}): StoredComment => ({
  id: 'mc-1',
  postId: 'p1',
  authorName: 'Toi',
  text: 'Super',
  createdAt: NOW - 60_000,
  mine: true,
  ...over,
});

describe('cleanCommentText', () => {
  it('rogne les espaces et plafonne à MAX_COMMENT', () => {
    expect(cleanCommentText('  salut  ')).toBe('salut');
    expect(cleanCommentText('a'.repeat(MAX_COMMENT + 50))).toHaveLength(MAX_COMMENT);
    expect(cleanCommentText(undefined as unknown as string)).toBe('');
  });
});

describe('canEditComment (auteur uniquement)', () => {
  it('seuls mes commentaires sont modifiables', () => {
    expect(canEditComment(c())).toBe(true);
    expect(canEditComment(c({ mine: false }))).toBe(false);
    expect(canEditComment(c({ mine: undefined, id: 'sc-1', authorName: 'tom.bao' }))).toBe(false);
  });
});

describe('editComment', () => {
  const list = [c(), c({ id: 'mc-2', text: 'Autre' }), c({ id: 'sc-1', mine: undefined, authorName: 'tom.bao', text: 'Noté' })];

  it('modification valide : texte nettoyé, editedAt posé, id et date de création inchangés', () => {
    const r = editComment(list, 'mc-1', '  Vraiment top  ', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const edited = r.comments.find(x => x.id === 'mc-1')!;
    expect(edited.text).toBe('Vraiment top');
    expect(edited.editedAt).toBe(NOW);
    expect(edited.id).toBe('mc-1');
    expect(edited.createdAt).toBe(NOW - 60_000);
    expect(r.comments).toHaveLength(3);
    expect(r.comments.find(x => x.id === 'mc-2')).toEqual(list[1]);
  });

  it('ne mute pas la liste d’origine', () => {
    const snapshot = JSON.parse(JSON.stringify(list));
    editComment(list, 'mc-1', 'Nouveau', NOW);
    expect(list).toEqual(snapshot);
  });

  it('texte plafonné à la longueur maximale', () => {
    const r = editComment(list, 'mc-1', 'z'.repeat(MAX_COMMENT + 10), NOW);
    expect(r.ok && r.comments[0].text.length).toBe(MAX_COMMENT);
  });

  it.each(['', '   ', '\n\t'])('texte vide refusé : %j', text => {
    expect(editComment(list, 'mc-1', text, NOW)).toEqual({ ok: false, reason: 'empty' });
  });

  it('texte identique : rien ne change (pas de faux « modifié »)', () => {
    expect(editComment(list, 'mc-1', ' Super ', NOW)).toEqual({ ok: false, reason: 'unchanged' });
  });

  it('refuse le commentaire d’un autre auteur', () => {
    expect(editComment(list, 'sc-1', 'Piraté', NOW)).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('id inconnu ou liste invalide', () => {
    expect(editComment(list, 'nope', 'x', NOW)).toEqual({ ok: false, reason: 'not_found' });
    expect(editComment(null as unknown as StoredComment[], 'mc-1', 'x', NOW)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('editedLabel', () => {
  it('« modifié à HH:mm »', () => {
    expect(editedLabel(NOW)).toMatch(/^modifié à \d{2}:\d{2}$/);
  });
  it('rien si jamais modifié ou date invalide', () => {
    expect(editedLabel(undefined)).toBeNull();
    expect(editedLabel(Number.NaN)).toBeNull();
  });
});

describe('fusion des commentaires (lib/cloud/merge)', () => {
  it('même id des deux côtés : la version éditée le plus récemment l’emporte', () => {
    const local = [c({ text: 'v1' })];
    const remote = [c({ text: 'v2', editedAt: NOW })];
    const merged = mergeKey('fooder_comments', local, remote) as StoredComment[];
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('v2');
  });

  it('version locale plus récente : elle est gardée', () => {
    const local = [c({ text: 'local', editedAt: NOW + 10 })];
    const remote = [c({ text: 'remote', editedAt: NOW })];
    expect((mergeKey('fooder_comments', local, remote) as StoredComment[])[0].text).toBe('local');
  });

  it('égalité ou aucune édition : la version locale reste', () => {
    expect((mergeKey('fooder_comments', [c({ text: 'a' })], [c({ text: 'b' })]) as StoredComment[])[0].text).toBe('a');
    expect((mergeKey('fooder_comments', [c({ text: 'a', editedAt: NOW })], [c({ text: 'b', editedAt: NOW })]) as StoredComment[])[0].text).toBe('a');
  });

  it('les ids différents restent une union', () => {
    const merged = mergeKey('fooder_comments', [c()], [c({ id: 'mc-9' })]) as StoredComment[];
    expect(merged.map(x => x.id).sort()).toEqual(['mc-1', 'mc-9']);
  });
});
