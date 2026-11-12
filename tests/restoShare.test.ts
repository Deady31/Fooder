import { describe, expect, it } from 'vitest';
import { findPlaceById, hoursSummary, resolvePhotoPreset, restoPath, restoUrl, shareText } from '../lib/restoShare';
import type { OsmRecord } from '../lib/osm';

const rec = (id: string, extra: Partial<OsmRecord> = {}): OsmRecord => ({
  id, n: 'Chez <Test>', k: 'restaurant', c: 'pizza', la: 43.6, ln: 1.44, a: '1 rue X', h: 'Mo-Su 12:00-22:00', w: '', d: 0, ...extra,
});
const DB = [rec('osm-n1'), rec('osm-w2', { n: 'Deux' }), rec('ovt-ab12-34')];

describe('findPlaceById', () => {
  it('trouve une fiche valide (osm et overture)', () => {
    expect(findPlaceById(DB, 'osm-w2')?.n).toBe('Deux');
    expect(findPlaceById(DB, 'ovt-ab12-34')?.id).toBe('ovt-ab12-34');
  });
  it('id inconnu, vide ou mal formé => null', () => {
    expect(findPlaceById(DB, 'osm-n999')).toBeNull();
    expect(findPlaceById(DB, '')).toBeNull();
    expect(findPlaceById(DB, undefined)).toBeNull();
  });
  it('tentatives d’injection => null (recherche exacte uniquement)', () => {
    expect(findPlaceById(DB, '../../etc/passwd')).toBeNull();
    expect(findPlaceById(DB, 'osm-n1<script>')).toBeNull();
    expect(findPlaceById(DB, 'osm-n1 ')).toBeNull();
    expect(findPlaceById(DB, 'OSM-N1')).toBeNull();
    expect(findPlaceById(DB, 'osm-n1/../x')).toBeNull();
  });
});

describe('resolvePhotoPreset', () => {
  it('retrouve nom et cuisine dans les données, pas dans l’URL', () => {
    expect(resolvePhotoPreset(DB, 'osm-w2')).toEqual({ id: 'osm-w2', name: 'Deux', cuisine: 'Pizzeria' });
  });
  it('id forgé, inconnu ou absent => null', () => {
    expect(resolvePhotoPreset(DB, 'osm-n999')).toBeNull();
    expect(resolvePhotoPreset(DB, 'x<script>')).toBeNull();
    expect(resolvePhotoPreset(DB, null)).toBeNull();
  });
});

describe('URL de partage', () => {
  it('chemin et URL absolue, id encodé', () => {
    expect(restoPath('osm-n1')).toBe('/resto/osm-n1');
    expect(restoUrl('https://fooder.app', 'osm-n1')).toBe('https://fooder.app/resto/osm-n1');
    expect(restoUrl('https://fooder.app/', 'osm-n1')).toBe('https://fooder.app/resto/osm-n1');
    expect(restoPath('a b/c')).toBe('/resto/a%20b%2Fc');
  });
  it('texte de partage', () => {
    expect(shareText('Chez Moi', 'Pizzeria')).toContain('Chez Moi');
  });
});

describe('hoursSummary', () => {
  const noon = new Date(2026, 10, 9, 13, 0);
  it('ouvert avec heure de fermeture', () => {
    expect(hoursSummary('Mo-Su 12:00-22:00', noon)).toBe('Ouvert, ferme à 22 h');
  });
  it('fermé', () => {
    expect(hoursSummary('Mo-Su 19:00-22:00', noon)).toBe('Fermé pour le moment');
  });
  it('inconnu', () => {
    expect(hoursSummary('', noon)).toBe('Horaires non communiqués');
    expect(hoursSummary(undefined, noon)).toBe('Horaires non communiqués');
  });
});
