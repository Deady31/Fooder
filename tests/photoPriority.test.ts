import { describe, expect, it } from 'vitest';
import { galleryFor, photoRank, viewerCredit, withBetterPhoto } from '../lib/photoPriority';
import { DISH_PHOTO_TIP, needsRealDishPhoto, shouldInviteRealPhoto } from '../lib/photoInvite';
import { osmToRestaurant } from '../lib/osm';
import type { Restaurant } from '../data/mockRestaurants';

const base: Restaurant = {
  id: 'osm-n1', name: 'Chez Test', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Pizzeria', image: '', address: 'x', description: '',
};

describe('photoRank', () => {
  it('communauté > plat typique > illustration ; Google n’est jamais une image de carte', () => {
    expect(photoRank('community')).toBeGreaterThan(photoRank('dish'));
    expect(photoRank('dish')).toBeGreaterThan(photoRank(undefined));
    expect(photoRank('google')).toBe(0);
  });
});

describe('withBetterPhoto', () => {
  it('Google ne remplace jamais une illustration ni un plat typique', () => {
    const ill = { ...base, image: 'ill.jpg' };
    expect(withBetterPhoto(ill, { source: 'google', images: ['g.jpg'] })).toBe(ill);
    const dish = { ...base, image: 'd.jpg', photoSource: 'dish' as const };
    expect(withBetterPhoto(dish, { source: 'google', images: ['g.jpg'], credit: 'Ann' })).toBe(dish);
  });

  it('un plat typique remplace une illustration', () => {
    const r = withBetterPhoto(base, { source: 'dish', images: ['d.jpg'], credit: 'Bob' });
    expect(r.photoSource).toBe('dish');
    expect(r.image).toBe('d.jpg');
    expect(r.photoCredit).toBe('Bob');
  });

  it('Google ne remplace jamais une photo communautaire', () => {
    const comm = { ...base, image: 'c.jpg', photoSource: 'community' as const };
    expect(withBetterPhoto(comm, { source: 'google', images: ['g.jpg'] })).toBe(comm);
  });

  it('la communauté passe devant le plat typique et efface son crédit', () => {
    const d = { ...base, image: 'd.jpg', photoSource: 'dish' as const, photoCredit: 'Ann', photoPage: 'p' };
    const r = withBetterPhoto(d, { source: 'community', images: ['c1.jpg', 'c2.jpg'] });
    expect(r.photoSource).toBe('community');
    expect(r.image).toBe('c1.jpg');
    expect(r.extraImages).toEqual(['c2.jpg']);
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
  it('photos des foodies d’abord, puis le plat typique, sans doublon', () => {
    const r = { ...base, image: 'd.jpg', extraImages: ['c1.jpg', 'd2.jpg'], photoSource: 'dish' as const };
    expect(galleryFor(r, ['c1.jpg'])).toEqual(['c1.jpg', 'd.jpg', 'd2.jpg']);
  });
  it('illustration : pas d’image dans la galerie', () => {
    expect(galleryFor({ ...base, image: 'ill.jpg' }, [])).toEqual([]);
  });
  it('une image Google n’entre jamais dans la galerie', () => {
    expect(galleryFor({ ...base, image: 'g.jpg', photoSource: 'google' as const }, [])).toEqual([]);
  });
});

describe('viewerCredit', () => {
  const dish = { ...base, image: 'd.jpg', photoSource: 'dish' as const, photoCredit: 'Bob', photoLicense: 'CC BY' };
  const g = { url: 'https://g/x.jpg', author: 'Ann' };
  it('communauté : aucun crédit', () => {
    expect(viewerCredit(dish, 'c.jpg', ['c.jpg'], g)).toBeNull();
  });
  it('plat typique : crédit du plat', () => {
    expect(viewerCredit(dish, 'd.jpg', [], g)).toBe('Plat typique · Bob, CC BY');
  });
  it('photo Google : crédit Google avec l’auteur', () => {
    expect(viewerCredit(dish, 'https://g/x.jpg', [], g)).toBe('Photo Google Maps · Ann');
  });
  it('illustration : aucun crédit', () => {
    expect(viewerCredit(base, 'ill.jpg', [], null)).toBeNull();
  });
});

describe('needsRealDishPhoto', () => {
  it('vrai sans photo communautaire', () => {
    expect(needsRealDishPhoto({ communityPhotos: [], photoSource: 'dish' })).toBe(true);
    expect(needsRealDishPhoto({ communityPhotos: [], photoSource: undefined })).toBe(true);
  });
  it('faux dès qu’il y a une photo communautaire (liste ou source)', () => {
    expect(needsRealDishPhoto({ communityPhotos: ['c.jpg'] })).toBe(false);
    expect(needsRealDishPhoto({ communityPhotos: [], photoSource: 'community' })).toBe(false);
  });
});

describe('DISH_PHOTO_TIP', () => {
  it('consigne : plat, pas devanture', () => {
    expect(DISH_PHOTO_TIP.title).toBe('Photographie ton plat (pas la devanture)');
    expect(DISH_PHOTO_TIP.example.length).toBeGreaterThan(10);
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
