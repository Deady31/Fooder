import { describe, expect, it } from 'vitest';
import { mergeAll, mergeKey } from '../lib/cloud/merge';
import { cardFromProfile } from '../lib/cloud/social';

describe('fusion local ⇄ compte', () => {
  it('unit les likes sans doublon et garde l’ordre local', () => {
    const local = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const remote = [{ id: 'b', name: 'B (serveur)' }, { id: 'c', name: 'C' }];
    expect((mergeKey('fooder_likes', local, remote) as { id: string }[]).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('garde le meilleur XP et réunit les trophées', () => {
    const out = mergeAll(
      { fooder_xp: { total: 120 }, fooder_achievements: ['first_like'] },
      { fooder_xp: { total: 300 }, fooder_achievements: ['first_like', 'visit_1'] }
    );
    expect(out.fooder_xp).toEqual({ total: 300 });
    expect(out.fooder_achievements).toEqual(['first_like', 'visit_1']);
  });

  it('ne perd aucune visite et les trie par date', () => {
    const v = (restId: string, at: number) => ({ restId, at, name: restId, cuisine: '', quartier: null, verdict: 'miam' });
    const out = mergeKey('fooder_visits', [v('a', 3)], [v('b', 1), v('a', 3)]) as { at: number }[];
    expect(out.map(x => x.at)).toEqual([1, 3]);
  });

  it('préfère une question « Tu y es allé ? » déjà traitée', () => {
    const out = mergeKey('fooder_checkins', [{ restId: 'a', status: 'pending' }], [{ restId: 'a', status: 'done' }]) as { status: string }[];
    expect(out[0].status).toBe('done');
  });

  it('garde la carte d’ami la plus récente', () => {
    const f = (at: number) => ({ snapshot: { id: 'u1', at }, addedAt: 1 });
    const out = mergeKey('fooder_friends', [f(10)], [f(20)]) as { snapshot: { at: number } }[];
    expect(out[0].snapshot.at).toBe(20);
  });

  it('ignore les valeurs absentes ou corrompues', () => {
    expect(mergeKey('fooder_likes', undefined, [{ id: 'x' }])).toEqual([{ id: 'x' }]);
    expect(mergeKey('fooder_likes', [{ id: 'x' }], null)).toEqual([{ id: 'x' }]);
    expect(mergeKey('fooder_likes', 'nope', [{ id: 'x' }, 42, null])).toEqual([{ id: 'x' }]);
    expect(mergeKey('fooder_avatar', { id: 'donut' }, { id: 'pizza' })).toEqual({ id: 'donut' });
  });
});

describe('profil serveur → carte d’ami', () => {
  it('valide la carte et impose id, pseudo et mascotte du profil', () => {
    const snap = cardFromProfile({
      id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      name: 'Léa',
      avatar_id: 'donut',
      avatar_bg: 'mint',
      card: { name: 'faux nom', level: 4, likes: [['r1', 'Pizza', 'Italien']], at: 9e15 },
    });
    expect(snap?.id).toBe('0f8fad5bd9cb469fa16570867728950e');
    expect(snap?.name).toBe('Léa');
    expect(snap?.level).toBe(4);
    expect(snap!.at).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
  });

  it('tolère une carte vide', () => {
    expect(cardFromProfile({ id: '0f8fad5b-d9cb-469f-a165-70867728950e', name: 'Tom', avatar_id: 'x', avatar_bg: 'y', card: {} })?.avatar.id).toBe('burger');
  });
});
