import { describe, expect, it } from 'vitest';
import { commentIdentity } from '../components/feed/commentAuthor';
import { StoredComment } from '../components/feed/commentEdit';

const c = (over: Partial<StoredComment>): StoredComment => ({ id: 'c1', postId: 'p1', authorName: 'lea_mange', text: 'Top', createdAt: 1, ...over });

describe('commentIdentity', () => {
  it('utilise l’avatar enregistré dans le commentaire', () => {
    const id = commentIdentity(c({ avatar: { id: 'donut', bg: 'lemon' } }));
    expect(id).toMatchObject({ name: 'lea_mange', avatar: { id: 'donut', bg: 'lemon' } });
  });
  it('ancien commentaire sans avatar : repli sur l’initiale', () => {
    const id = commentIdentity(c({ authorName: 'tom.bao' }));
    expect(id.avatar).toBeNull();
    expect(id.initial).toBe('T');
  });
  it('avatar inconnu ou mal formé : repli (aucun chemin construit depuis une valeur douteuse)', () => {
    expect(commentIdentity(c({ avatar: { id: '../../x', bg: 'lemon' } })).avatar).toBeNull();
    expect(commentIdentity(c({ avatar: 'burger' as never })).avatar).toBeNull();
    expect(commentIdentity(c({ avatar: null as never })).avatar).toBeNull();
  });
  it('fond inconnu : fond par défaut de la mascotte', () => {
    expect(commentIdentity(c({ avatar: { id: 'burger', bg: 'nope' } })).avatar).toEqual({ id: 'burger', bg: 'bubblegum' });
  });
  it('nom vide : « Anonyme » et initiale ?', () => {
    const id = commentIdentity(c({ authorName: '   ' }));
    expect(id.name).toBe('Anonyme');
    expect(id.initial).toBe('?');
  });
  it('initiale avec accent, emoji ou minuscule', () => {
    expect(commentIdentity(c({ authorName: 'élodie' })).initial).toBe('É');
    expect(commentIdentity(c({ authorName: '🍕pizza' })).initial).toBe('🍕');
  });
  it('mon ancien commentaire (nom « Toi ») reste « Toi »', () => {
    expect(commentIdentity(c({ authorName: 'Toi', mine: true })).name).toBe('Toi');
  });
});
