import { describe, expect, it } from 'vitest';
import { acceptDetails, sameVenue } from '../lib/google/placePhotos';

describe('photos Google : bon restaurant ?', () => {
  it('reconnaît le même lieu malgré accents et articles', () => {
    expect(sameVenue('Le Scintilà', 'Scintila')).toBe(true);
    expect(sameVenue("Chez Marcel", 'Marcel')).toBe(true);
    expect(sameVenue('Pizza Lola', 'PIZZA LOLA Toulouse')).toBe(true);
  });

  it('refuse un lieu voisin différent', () => {
    expect(sameVenue('Pizza Lola', 'Burger King')).toBe(false);
    expect(sameVenue('Le Palais', 'Hôtel de ville')).toBe(false);
    expect(sameVenue('', 'Quelque chose')).toBe(false);
  });
});

describe('acceptDetails', () => {
  const ours = { name: 'Pizza Lola', lat: 43.6045, lng: 1.4442 };
  const photo = (id: string) => ({ name: `places/ChIJabc123def/photos/${id}`, authorAttributions: [{ displayName: 'Léa', uri: 'https://maps.google.com/contrib/123' }] });

  it('garde les photos d’un lieu cohérent', () => {
    const out = acceptDetails({ displayName: { text: 'Pizza Lola' }, location: { latitude: 43.6046, longitude: 1.4443 }, photos: [photo('AAA'), photo('BBB')] }, ours);
    expect(out).toHaveLength(2);
    expect(out[0].author).toBe('Léa');
    expect(out[0].authorUri).toMatch(/^https:\/\/maps\.google\.com/);
  });

  it('rejette un lieu trop éloigné ou au nom différent', () => {
    expect(acceptDetails({ displayName: { text: 'Pizza Lola' }, location: { latitude: 43.62, longitude: 1.46 }, photos: [photo('A')] }, ours)).toEqual([]);
    expect(acceptDetails({ displayName: { text: 'Autre resto' }, location: { latitude: 43.6045, longitude: 1.4442 }, photos: [photo('A')] }, ours)).toEqual([]);
  });

  it('ignore les références de photo suspectes et les liens d’auteur hors Google', () => {
    const out = acceptDetails(
      {
        displayName: { text: 'Pizza Lola' },
        location: { latitude: 43.6045, longitude: 1.4442 },
        photos: [
          { name: 'places/x/photos/../../admin' },
          { name: 'javascript:alert(1)' },
          { name: 'places/ChIJabc123def/photos/OK', authorAttributions: [{ displayName: 'Tom', uri: 'https://evil.example/phish' }] },
        ],
      },
      ours
    );
    expect(out).toHaveLength(1);
    expect(out[0].authorUri).toBeUndefined();
  });

  it('limite à 3 photos', () => {
    const many = Array.from({ length: 8 }, (_, i) => photo(`P${i}`));
    expect(acceptDetails({ displayName: { text: 'Pizza Lola' }, location: { latitude: 43.6045, longitude: 1.4442 }, photos: many }, ours)).toHaveLength(3);
  });
});
