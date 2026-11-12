import { describe, expect, it } from 'vitest';
import { safeCommonsPage, safeWebUrl } from '../lib/safeUrl';
import { OsmRecord, osmToRestaurant } from '../lib/osm';

describe('safeWebUrl', () => {
  it('garde http et https', () => {
    expect(safeWebUrl('https://www.lemasymas.com/carte')).toBe('https://www.lemasymas.com/carte');
    expect(safeWebUrl('http://exemple.fr')).toBe('http://exemple.fr/');
  });
  it('ajoute https:// devant un domaine nu', () => {
    expect(safeWebUrl('www.lemasymas.com')).toBe('https://www.lemasymas.com/');
    expect(safeWebUrl('lemasymas.com/menu')).toBe('https://lemasymas.com/menu');
  });
  it('rejette les autres schémas', () => {
    expect(safeWebUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeWebUrl('JaVaScRiPt:alert(1)')).toBeUndefined();
    expect(safeWebUrl(' javascript:alert(1)')).toBeUndefined();
    expect(safeWebUrl('data:text/html,<script>1</script>')).toBeUndefined();
    expect(safeWebUrl('vbscript:x')).toBeUndefined();
    expect(safeWebUrl('ftp://exemple.fr')).toBeUndefined();
    expect(safeWebUrl('//evil.com')).toBeUndefined();
  });
  it('gère vide, espaces et types invalides', () => {
    expect(safeWebUrl('')).toBeUndefined();
    expect(safeWebUrl('   ')).toBeUndefined();
    expect(safeWebUrl(undefined)).toBeUndefined();
    expect(safeWebUrl(null)).toBeUndefined();
    expect(safeWebUrl('  https://exemple.fr  ')).toBe('https://exemple.fr/');
    expect(safeWebUrl('deux mots')).toBeUndefined();
  });
});

describe('safeCommonsPage', () => {
  it('n accepte que commons.wikimedia.org en https', () => {
    expect(safeCommonsPage('https://commons.wikimedia.org/wiki/File:Pizza.jpg')).toBe('https://commons.wikimedia.org/wiki/File:Pizza.jpg');
    expect(safeCommonsPage('http://commons.wikimedia.org/wiki/File:Pizza.jpg')).toBeUndefined();
    expect(safeCommonsPage('https://commons.wikimedia.org.evil.com/x')).toBeUndefined();
    expect(safeCommonsPage('https://evil.com/https://commons.wikimedia.org/')).toBeUndefined();
    expect(safeCommonsPage('javascript:alert(1)')).toBeUndefined();
    expect(safeCommonsPage(undefined)).toBeUndefined();
  });
});

describe('osmToRestaurant website', () => {
  const rec = (w: string): OsmRecord => ({ id: 'osm-n1', n: 'Chez Test', k: 'restaurant', c: 'french', la: 43.6, ln: 1.44, a: '', h: '', w, d: 0 });
  it('nettoie le site web', () => {
    expect(osmToRestaurant(rec('javascript:alert(1)')).website).toBeUndefined();
    expect(osmToRestaurant(rec('www.lemasymas.com')).website).toBe('https://www.lemasymas.com/');
    expect(osmToRestaurant(rec('')).website).toBeUndefined();
  });
});
