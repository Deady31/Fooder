import { describe, expect, it } from 'vitest';
import { consentedPhotoFor, restaurantPhoto, RESTAURANT_PHOTO_CREDIT } from '../lib/sitePhotos';
import { PHOTO_PRIORITY, photoRank, viewerCredit, withBetterPhoto, galleryFor } from '../lib/photoPriority';
import { photoCreditLine } from '../components/ui/lightboxMath';
import { needsRealDishPhoto } from '../lib/photoInvite';
import { osmToRestaurant } from '../lib/osm';
import type { Restaurant } from '../data/mockRestaurants';
// @ts-ignore script Node (JS)
import { matchName, normalizeName, parseCsv, parseRows } from '../scripts/import-restaurant-photos.mjs';

const photo: any = { src: '/restos/osm-n1.jpg', kind: 'dish', credit: RESTAURANT_PHOTO_CREDIT, consentedAt: '2026-11-13T10:00:00.000Z' };
const consent = (ids: string[]) => ({
  version: 1,
  restaurants: Object.fromEntries(ids.map(i => [i, { name: 'X', consentedAt: '2026-11-13T10:00:00.000Z', source: 'phone' }])),
});

const base: Restaurant = {
  id: 'osm-n1', name: 'Chez Test', rating: 0, price: 0, distance: 'Toulouse', cuisine: 'Pizzeria', image: '', address: 'x', description: '',
};

describe('consentement', () => {
  it('refus par défaut : fichier de consentement vide, aucune photo exposée', () => {
    expect(consentedPhotoFor('osm-n1', { 'osm-n1': photo }, consent([]))).toBeNull();
    expect(restaurantPhoto('osm-n-inconnu')).toBeNull();
  });
  it('photo exposée seulement si consentement ET photo présente', () => {
    expect(consentedPhotoFor('osm-n1', { 'osm-n1': photo }, consent(['osm-n1']))).toEqual(photo);
    expect(consentedPhotoFor('osm-n1', {}, consent(['osm-n1']))).toBeNull();
  });
  it('retrait du consentement = entrée supprimée = photo masquée', () => {
    expect(consentedPhotoFor('osm-n1', { 'osm-n1': photo }, consent(['osm-n2']))).toBeNull();
  });
  it('ignore une entrée sans src ou avec un type inconnu', () => {
    expect(consentedPhotoFor('osm-n1', { 'osm-n1': { ...photo, src: '' } }, consent(['osm-n1']))).toBeNull();
    expect(consentedPhotoFor('osm-n1', { 'osm-n1': { ...photo, kind: 'x' as any } }, consent(['osm-n1']))).toBeNull();
  });
  it('osmToRestaurant n’affiche aucune photo de resto sans consentement', () => {
    const r = osmToRestaurant({ id: 'osm-n250665866', n: 'Folles Saisons', k: 'restaurant', c: 'french', la: 43.6, ln: 1.44, a: '', h: '', w: '', d: 0 });
    expect(r.photoSource === 'site' || r.photoSource === 'restaurant').toBe(false);
  });
});

describe('priorité d’affichage', () => {
  it('constante : plat du resto > communauté > site > plat typique', () => {
    expect(PHOTO_PRIORITY).toEqual(['restaurant', 'community', 'site', 'dish']);
    expect(photoRank('restaurant')).toBeGreaterThan(photoRank('community'));
    expect(photoRank('community')).toBeGreaterThan(photoRank('site'));
    expect(photoRank('site')).toBeGreaterThan(photoRank('dish'));
    expect(photoRank('dish')).toBeGreaterThan(photoRank(undefined));
    expect(photoRank('google')).toBe(0);
  });
  it('chaque source ne remplace que plus bas qu’elle', () => {
    const comm = { ...base, image: 'c.jpg', photoSource: 'community' as const };
    expect(withBetterPhoto(comm, { source: 'site', images: ['s.jpg'] })).toBe(comm);
    expect(withBetterPhoto(comm, { source: 'restaurant', images: ['r.jpg'] }).photoSource).toBe('restaurant');
    const site = { ...base, image: 's.jpg', photoSource: 'site' as const };
    expect(withBetterPhoto(site, { source: 'dish', images: ['d.jpg'] })).toBe(site);
    expect(withBetterPhoto({ ...base, image: 'd.jpg', photoSource: 'dish' as const }, { source: 'site', images: ['s.jpg'] }).photoSource).toBe('site');
  });
  it('la galerie contient la photo du resto', () => {
    expect(galleryFor({ ...base, image: 'r.jpg', photoSource: 'restaurant' }, [])).toEqual(['r.jpg']);
  });
  it('photo de plat du resto : plus d’invitation ; photo de site : oui', () => {
    expect(needsRealDishPhoto({ communityPhotos: [], photoSource: 'restaurant' })).toBe(false);
    expect(needsRealDishPhoto({ communityPhotos: [], photoSource: 'site' })).toBe(true);
  });
});

describe('crédits', () => {
  it('ligne de crédit : photo fournie par le restaurant', () => {
    expect(photoCreditLine('restaurant', RESTAURANT_PHOTO_CREDIT)).toBe('Photo fournie par le restaurant');
    expect(photoCreditLine('site', RESTAURANT_PHOTO_CREDIT)).toBe('Photo fournie par le restaurant');
    expect(photoCreditLine('site')).toBe('Photo du restaurant');
    expect(photoCreditLine('dish', 'Jean', 'CC BY')).toBe('Plat typique · Jean, CC BY');
  });
  it('visionneuse : crédit sur l’image principale', () => {
    const r: Restaurant = { ...base, image: 'r.jpg', photoSource: 'restaurant', photoCredit: RESTAURANT_PHOTO_CREDIT };
    expect(viewerCredit(r, 'r.jpg', [], null)).toBe('Photo fournie par le restaurant');
  });
});

const places = [
  { id: 'osm-n1', n: 'Chez Éloïse', a: '1 rue A, Toulouse' },
  { id: 'osm-n2', n: "L'Auberge du Pont", a: '2 rue B, Toulouse' },
  { id: 'osm-n3', n: 'Pizza Roma', a: '3 rue C, Toulouse' },
  { id: 'osm-n4', n: 'Pizza Roma', a: '4 rue D, Blagnac' },
  { id: 'osm-n5', n: 'Le Bistrot Gourmand', a: '5 rue E, Toulouse' },
];

describe('rapprochement des noms', () => {
  it('normalise accents, casse, chez, ponctuation', () => {
    expect(normalizeName('  CHEZ Éloïse! ')).toBe(normalizeName('eloise'));
    expect(normalizeName("L'Auberge-du Pont")).toBe(normalizeName('auberge du pont'));
  });
  it('correspondance sûre', () => {
    const m = matchName('chez eloise', places);
    expect(m.status).toBe('sure');
    expect(m.candidates.map((c: any) => c.id)).toEqual(['osm-n1']);
    expect(matchName("l'auberge du pont", places).status).toBe('sure');
  });
  it('ambiguë : liste des candidats avec adresse', () => {
    const m = matchName('Pizza Roma', places);
    expect(m.status).toBe('ambiguous');
    expect(m.candidates.map((c: any) => c.a)).toEqual(['3 rue C, Toulouse', '4 rue D, Blagnac']);
  });
  it('un nom partiel n’est jamais « sûr »', () => {
    expect(matchName('Bistrot', places).status).toBe('ambiguous');
  });
  it('introuvable, vide, null', () => {
    expect(matchName('Sushi Zen', places).status).toBe('missing');
    expect(matchName('', places).status).toBe('missing');
    expect(matchName(null as any, places).status).toBe('missing');
  });
  it('un id OSM saisi à la place du nom est accepté', () => {
    expect(matchName('osm-n3', places)).toMatchObject({ status: 'sure' });
  });
});

describe('lecture CSV / JSON', () => {
  it('CSV nom;fichier;type;date;moyen, avec ou sans en-tête, guillemets', () => {
    const rows = parseCsv('nom;fichier;type;date;moyen\n"Chez Éloïse";plat1.jpg;plat;2026-11-10;téléphone\nPizza Roma;;site;2026-11-11;whatsapp\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ nom: 'Chez Éloïse', fichier: 'plat1.jpg', type: 'plat', moyen: 'téléphone' });
    expect(parseCsv('Pizza Roma;a.jpg;site;2026-11-11;email')).toHaveLength(1);
  });
  it('normalise type et moyen, rejette les valeurs invalides', () => {
    const { rows, errors } = parseRows([
      { nom: 'A', fichier: 'a.jpg', type: 'plat', date: '2026-11-10', moyen: 'téléphone' },
      { nom: 'B', fichier: 'b.jpg', type: 'dish', date: '2026-11-10', moyen: 'mail' },
      { nom: 'C', fichier: 'c.jpg', type: 'bizarre', date: '2026-11-10', moyen: 'phone' },
      { nom: 'D', fichier: 'd.jpg', type: 'site', date: 'pas une date', moyen: 'phone' },
    ]);
    expect(rows.map((r: any) => [r.kind, r.source])).toEqual([['dish', 'phone'], ['dish', 'email']]);
    expect(errors).toHaveLength(2);
  });
});
