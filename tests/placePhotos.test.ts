import { describe, expect, it } from 'vitest';
import {
  buildDetailsRequest,
  buildMediaUrl,
  buildSearchRequest,
  pickBestMatch,
  pickPhoto,
  sameVenue,
} from '../lib/google/placePhotos';
import { DEFAULT_DAILY_CAP, createDailyCounter, parisDay, parseDailyCap } from '../lib/google/dailyCap';
import { MAX_PLACE_IDS, addPlaceId, findPlaceId } from '../lib/google/placeIdCache';

const ours = { name: 'Pizza Lola', lat: 43.6045, lng: 1.4442 };

describe('sameVenue', () => {
  it('reconnaît le même lieu malgré accents et articles', () => {
    expect(sameVenue('Le Scintilà', 'Scintila')).toBe(true);
    expect(sameVenue('Chez Marcel', 'Marcel')).toBe(true);
    expect(sameVenue('Pizza Lola', 'PIZZA LOLA Toulouse')).toBe(true);
  });

  it('refuse un lieu voisin différent', () => {
    expect(sameVenue('Pizza Lola', 'Burger King')).toBe(false);
    expect(sameVenue('Le Palais', 'Hôtel de ville')).toBe(false);
    expect(sameVenue('', 'Quelque chose')).toBe(false);
  });
});

describe('pickBestMatch', () => {
  it('accepte un candidat « identifiant seul » (déjà borné par la zone de recherche)', () => {
    expect(pickBestMatch([{ id: 'ChIJabc123def' }], ours)).toBe('ChIJabc123def');
  });

  it('vérifie nom et distance quand les champs sont fournis', () => {
    const near = { id: 'ChIJnear00001', displayName: { text: 'Pizza Lola' }, location: { latitude: 43.6046, longitude: 1.4443 } };
    const far = { id: 'ChIJfar000001', displayName: { text: 'Pizza Lola' }, location: { latitude: 43.62, longitude: 1.46 } };
    const other = { id: 'ChIJother0001', displayName: { text: 'Burger King' }, location: { latitude: 43.6045, longitude: 1.4442 } };
    expect(pickBestMatch([other, far, near], ours)).toBe('ChIJnear00001');
    expect(pickBestMatch([other, far], ours)).toBeNull();
  });

  it('préfère le candidat le plus proche parmi les valides', () => {
    const a = { id: 'ChIJaaaaaaaa1', displayName: { text: 'Pizza Lola' }, location: { latitude: 43.6055, longitude: 1.4442 } };
    const b = { id: 'ChIJbbbbbbbb1', displayName: { text: 'Pizza Lola' }, location: { latitude: 43.6046, longitude: 1.4442 } };
    expect(pickBestMatch([a, b], ours)).toBe('ChIJbbbbbbbb1');
  });

  it('rejette liste vide, undefined et identifiants suspects', () => {
    expect(pickBestMatch([], ours)).toBeNull();
    expect(pickBestMatch(undefined, ours)).toBeNull();
    expect(pickBestMatch([{ id: '../admin' }, { id: 'x' }, {}], ours)).toBeNull();
  });
});

describe('construction des requêtes', () => {
  it('recherche gratuite : field mask places.id seul, zone ±250 m, 1 résultat', () => {
    const r = buildSearchRequest(ours, false);
    expect(r.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(r.headers['X-Goog-FieldMask']).toBe('places.id');
    const body = r.body as { textQuery: string; maxResultCount: number; locationRestriction: { rectangle: { low: { latitude: number }; high: { latitude: number } } } };
    expect(body.textQuery).toContain('Pizza Lola');
    expect(body.maxResultCount).toBe(1);
    const { low, high } = body.locationRestriction.rectangle;
    expect(low.latitude).toBeLessThan(ours.lat);
    expect(high.latitude).toBeGreaterThan(ours.lat);
    expect((high.latitude - low.latitude) * 111_320).toBeGreaterThan(450);
    expect((high.latitude - low.latitude) * 111_320).toBeLessThan(550);
  });

  it('mode vérification : demande nom + position (plus cher) avec plusieurs candidats', () => {
    const r = buildSearchRequest(ours, true);
    expect(r.headers['X-Goog-FieldMask']).toBe('places.id,places.displayName,places.location');
    expect((r.body as { maxResultCount: number }).maxResultCount).toBeGreaterThan(1);
  });

  it('détails : uniquement le champ photos', () => {
    const r = buildDetailsRequest('ChIJabc123def');
    expect(r.url).toBe('https://places.googleapis.com/v1/places/ChIJabc123def');
    expect(r.headers['X-Goog-FieldMask']).toBe('photos');
  });

  it('média : une photo, 800 px, URL temporaire sans redirection', () => {
    const url = buildMediaUrl('places/ChIJabc123def/photos/AAA');
    expect(url).toBe('https://places.googleapis.com/v1/places/ChIJabc123def/photos/AAA/media?maxWidthPx=800&skipHttpRedirect=true');
  });
});

describe('pickPhoto', () => {
  const photo = (id: string, extra: object = {}) => ({
    name: `places/ChIJabc123def/photos/${id}`,
    googleMapsUri: 'https://www.google.com/maps/place/Pizza+Lola',
    authorAttributions: [{ displayName: 'Léa', uri: 'https://maps.google.com/contrib/123' }],
    ...extra,
  });

  it('prend la première photo avec attribution et lien Google Maps', () => {
    const out = pickPhoto({ photos: [photo('AAA'), photo('BBB')] });
    expect(out).toEqual({
      name: 'places/ChIJabc123def/photos/AAA',
      author: 'Léa',
      authorUri: 'https://maps.google.com/contrib/123',
      googleMapsUri: 'https://www.google.com/maps/place/Pizza+Lola',
    });
  });

  it('ignore références suspectes et liens hors Google', () => {
    const out = pickPhoto({
      photos: [
        { name: 'places/x/photos/../../admin' },
        { name: 'javascript:alert(1)' },
        { name: 'places/ChIJabc123def/photos/OK', googleMapsUri: 'https://evil.example/x', authorAttributions: [{ displayName: 'Tom', uri: 'https://evil.example/phish' }] },
      ],
    });
    expect(out?.name).toBe('places/ChIJabc123def/photos/OK');
    expect(out?.authorUri).toBeUndefined();
    expect(out?.googleMapsUri).toBeUndefined();
  });

  it('auteur par défaut et tronqué ; null sans photo', () => {
    expect(pickPhoto({ photos: [{ name: 'places/ChIJabc123def/photos/Z' }] })?.author).toBe('Google Maps');
    expect(pickPhoto({ photos: [photo('Y', { authorAttributions: [{ displayName: 'x'.repeat(200) }] })] })?.author).toHaveLength(60);
    expect(pickPhoto({})).toBeNull();
    expect(pickPhoto({ photos: [] })).toBeNull();
  });
});

describe('jour de Paris et plafond', () => {
  it('calcule le jour en heure de Paris (hiver et été)', () => {
    expect(parisDay(new Date('2026-11-13T22:30:00Z'))).toBe('2026-11-13');
    expect(parisDay(new Date('2026-11-13T23:30:00Z'))).toBe('2026-11-14');
    expect(parisDay(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(parisDay(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });

  it('lit le plafond depuis l’environnement (défaut 30)', () => {
    expect(DEFAULT_DAILY_CAP).toBe(30);
    expect(parseDailyCap(undefined)).toBe(30);
    expect(parseDailyCap('')).toBe(30);
    expect(parseDailyCap('abc')).toBe(30);
    expect(parseDailyCap('-5')).toBe(30);
    expect(parseDailyCap('12')).toBe(12);
    expect(parseDailyCap('0')).toBe(0);
    expect(parseDailyCap('7.9')).toBe(7);
  });

  it('consomme jusqu’au plafond puis refuse', () => {
    const c = createDailyCounter(2);
    const t = new Date('2026-11-13T10:00:00Z');
    expect(c.tryConsume(t)).toBe(true);
    expect(c.tryConsume(t)).toBe(true);
    expect(c.tryConsume(t)).toBe(false);
    expect(c.isExhausted(t)).toBe(true);
    expect(c.used(t)).toBe(2);
  });

  it('se remet à zéro au changement de jour parisien', () => {
    const c = createDailyCounter(1);
    expect(c.tryConsume(new Date('2026-11-13T10:00:00Z'))).toBe(true);
    expect(c.tryConsume(new Date('2026-11-13T22:59:00Z'))).toBe(false);
    expect(c.tryConsume(new Date('2026-11-13T23:00:00Z'))).toBe(true);
  });

  it('plafond 0 : jamais d’appel payant', () => {
    expect(createDailyCounter(0).tryConsume(new Date())).toBe(false);
  });
});

describe('cache client restoId -> place_id', () => {
  it('ajoute et retrouve', () => {
    const list = addPlaceId([], 'r1', 'ChIJaaaaaaaa1');
    expect(findPlaceId(list, 'r1')).toBe('ChIJaaaaaaaa1');
    expect(findPlaceId(list, 'r2')).toBeNull();
  });

  it('ne mute pas la liste d’origine et remplace une entrée existante en la rajeunissant', () => {
    const base = [['r1', 'ChIJaaaaaaaa1'], ['r2', 'ChIJbbbbbbbb1']] as [string, string][];
    const next = addPlaceId(base, 'r1', 'ChIJcccccccc1');
    expect(base).toHaveLength(2);
    expect(base[0][1]).toBe('ChIJaaaaaaaa1');
    expect(next).toEqual([['r2', 'ChIJbbbbbbbb1'], ['r1', 'ChIJcccccccc1']]);
  });

  it('évince les plus anciennes au-delà de la borne', () => {
    let list: [string, string][] = [];
    for (let i = 0; i < MAX_PLACE_IDS + 5; i++) list = addPlaceId(list, `r${i}`, `ChIJ${String(i).padStart(8, '0')}`);
    expect(list).toHaveLength(MAX_PLACE_IDS);
    expect(findPlaceId(list, 'r0')).toBeNull();
    expect(findPlaceId(list, `r${MAX_PLACE_IDS + 4}`)).not.toBeNull();
  });

  it('refuse les identifiants invalides', () => {
    expect(addPlaceId([], 'r1', '../x')).toEqual([]);
    expect(addPlaceId([], '', 'ChIJaaaaaaaa1')).toEqual([]);
  });
});
