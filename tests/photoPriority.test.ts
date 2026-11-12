import { describe, expect, it } from 'vitest';
import { galleryFor, photoRank, withBetterPhoto } from '../lib/photoPriority';
import { shouldInviteRealPhoto } from '../lib/photoInvite';
import { osmToRestaurant } from '../lib/osm';
import type { Restaurant } from '../data/mockRestaurants';

const base: Restaurant = {
  id: 'osm-n1', name: 'Chez Test', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Pizzeria', image: '', address: 'x', description: '',
};

describe('photoRank', () => {
  it('communauté > Google > plat > illustration', () => {
    expect(photoRank('community')).toBeGreaterThan(photoRank('google'));
    expect(photoRank('google')).toBeGreaterThan(photoRank('dish'));
    expect(photoRank('dish')).toBeGreaterThan(photoRank(undefined));
  });
});

describe('withBetterPhoto', () => {
  it('Google remplace un plat typique', () => {
    const dish = { ...base, image: 'd.jpg', photoSource: 'dish' as const };
    const r = withBetterPhoto(dish, { source: 'google', images: ['g1.jpg', 'g2.jpg'], credit: 'Ann' });
    expect(r.photoSource).toBe('google');
    expect(r.image).toBe('g1.jpg');
    expect(r.extraImages).toEqual(['g2.jpg']);
    expect(r.photoCredit).toBe('Ann');
  });

  it('Google ne remplace jamais une photo communautaire', () => {
    const comm = { ...base, image: 'c.jpg', photoSource: 'community' as const };
    expect(withBetterPhoto(comm, { source: 'google', images: ['g.jpg'] })).toBe(comm);
  });

  it('la communauté passe devant Google et efface le crédit Google', () => {
    const g = { ...base, image: 'g.jpg', photoSource: 'google' as const, photoCredit: 'Ann', photoPage: 'p' };
    const r = withBetterPhoto(g, { source: 'community', images: ['c1.jpg', 'c2.jpg'] });
    expect(r.photoSource).toBe('community');
    expect(r.image).toBe('c1.jpg');
    expect(r.photoCredit).toBeUndefined();
    expect(r.photoPage).toBeUndefined();
  });

  it('candidat vide : fiche inchangée ; ne mute pas', () => {
    const frozen = Object.freeze({ ...base });
    expect(withBetterPhoto(frozen, { source: 'community', images: [] })).toBe(frozen);
    expect(withBetterPhoto(frozen, { source: 'dish', images: ['d.jpg'] })).not.toBe(frozen);
  });

  it('osmToRestaurant utilise la priorité (plat typique par défaut)', () => {
    const r = osmToRestaurant({ id: 'osm-n9', n: 'Pizza Roma', k: 'restaurant', c: 'pizza', la: 43.6, ln: 1.44, a: '', h: '', w: '', d: 0 });
    expect(r.photoSource === 'dish' || r.photoSource === undefined).toBe(true);
  });
});

describe('galleryFor', () => {
  it('photos des foodies d’abord, sans doublon', () => {
    const r = { ...base, image: 'g.jpg', extraImages: ['c1.jpg', 'g2.jpg'], photoSource: 'google' as const };
    expect(galleryFor(r, ['c1.jpg'])).toEqual(['c1.jpg', 'g.jpg', 'g2.jpg']);
  });
  it('illustration : pas d’image dans la galerie', () => {
    expect(galleryFor({ ...base, image: 'ill.jpg' }, [])).toEqual([]);
  });
});

describe('shouldInviteRealPhoto', () => {
  it('invite si aucune photo communautaire et aucun post de l’utilisateur', () => {
    expect(shouldInviteRealPhoto({ restId: 'a', communityPhotos: [], myPostPhotoRestIds: [] })).toBe(true);
  });
  it('pas d’invitation si une photo communautaire existe', () => {
    expect(shouldInviteRealPhoto({ restId: 'a', communityPhotos: ['c.jpg'], myPostPhotoRestIds: [] })).toBe(false);
  });
  it('pas d’invitation si l’utilisateur a déjà posté pour ce resto', () => {
    expect(shouldInviteRealPhoto({ restId: 'a', communityPhotos: [], myPostPhotoRestIds: ['a'] })).toBe(false);
  });
  it('pas d’invitation si l’utilisateur a déjà posté une photo dans le flux de visite', () => {
    expect(shouldInviteRealPhoto({ restId: 'a', communityPhotos: [], myPostPhotoRestIds: ['b'], postedInFlow: true })).toBe(false);
  });
});
