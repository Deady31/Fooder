import { describe, expect, it } from 'vitest';
import { mergeCommunityPhotos, photoLikesLine, rankCommunityPhotos, withBetterPhoto } from '../lib/photoPriority';
import type { Restaurant } from '../data/mockRestaurants';

const base: Restaurant = {
  id: 'osm-n1', name: 'Chez Test', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Pizzeria', image: '', address: 'x', description: '',
};
const p = (url: string, likes: number, createdAt: number) => ({ postId: url, url, likes, createdAt });

describe('rankCommunityPhotos : la plus aimée gagne', () => {
  it('trie par cœurs décroissants', () => {
    expect(rankCommunityPhotos([p('a', 2, 5), p('b', 12, 1), p('c', 7, 9)]).map(x => x.url)).toEqual(['b', 'c', 'a']);
  });

  it('égalité : la plus récente d’abord', () => {
    expect(rankCommunityPhotos([p('old', 3, 1), p('new', 3, 99), p('mid', 3, 50)]).map(x => x.url)).toEqual(['new', 'mid', 'old']);
  });

  it('liste vide, entrée non modifiée', () => {
    expect(rankCommunityPhotos([])).toEqual([]);
    const input = [p('a', 1, 1), p('b', 2, 2)];
    rankCommunityPhotos(input);
    expect(input.map(x => x.url)).toEqual(['a', 'b']);
  });

  it('cœurs invalides (NaN, négatifs) traités comme 0', () => {
    expect(rankCommunityPhotos([p('bad', Number.NaN, 9), p('neg', -3, 8), p('ok', 1, 1)]).map(x => x.url)).toEqual(['ok', 'bad', 'neg']);
  });

  it('supporte 10 000 photos', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => p(`u${i}`, i % 50, i));
    const ranked = rankCommunityPhotos(many);
    expect(ranked[0].likes).toBe(49);
    expect(ranked).toHaveLength(10_000);
  });
});

describe('mergeCommunityPhotos', () => {
  it('une photo aimée du cloud passe devant mes photos locales', () => {
    expect(mergeCommunityPhotos(['local'], [p('c1', 0, 9), p('c2', 5, 1)])).toEqual(['c2', 'local', 'c1']);
  });

  it('sans aucun cœur : mes photos locales d’abord, puis le cloud par récence', () => {
    expect(mergeCommunityPhotos(['local'], [p('old', 0, 1), p('new', 0, 9)])).toEqual(['local', 'new', 'old']);
  });

  it('dédoublonne et tolère les listes vides', () => {
    expect(mergeCommunityPhotos([], [])).toEqual([]);
    expect(mergeCommunityPhotos(['x', 'x'], [p('x', 1, 1)])).toEqual(['x']);
  });
});

describe('withBetterPhoto : la carte affiche la photo la plus aimée', () => {
  it('la première image de la liste fusionnée devient l’image de la carte', () => {
    const photos = mergeCommunityPhotos([], [p('https://x/a.jpg', 1, 9), p('https://x/b.jpg', 8, 1)]);
    const out = withBetterPhoto(base, { source: 'community', images: photos });
    expect(out.image).toBe('https://x/b.jpg');
    expect(out.extraImages).toEqual(['https://x/a.jpg']);
  });
});

describe('photoLikesLine', () => {
  it('cœurs et auteur', () => expect(photoLikesLine({ likes: 12, author: 'lea' })).toBe('12 ♥ · photo de @lea'));
  it('auteur seul ou cœurs seuls', () => {
    expect(photoLikesLine({ likes: 0, author: 'lea' })).toBe('photo de @lea');
    expect(photoLikesLine({ likes: 3 })).toBe('3 ♥');
  });
  it('aucune donnée : rien', () => {
    expect(photoLikesLine({ likes: 0 })).toBeNull();
    expect(photoLikesLine({ likes: Number.NaN, author: '' })).toBeNull();
  });
});
