import { describe, expect, it } from 'vitest';
import { isPresentableBase, type OsmRecord } from '../lib/osm';

const base: OsmRecord = { id: 'x', n: 'Chez Test', k: 'restaurant', c: '', la: 43.6, ln: 1.44, a: '1 rue A, Toulouse', h: '', w: 'http://a.fr', t: '+33582952158', d: 0, s: 'v' };

describe('isPresentableBase (critères d’information, hors barrière d’adresse)', () => {
  it('écarte une fiche sans cuisine ni horaires (ex. éditeur de logiciel)', () => {
    expect(isPresentableBase({ ...base, n: 'Unirest' })).toBe(false);
  });
  it('garde une fiche avec cuisine connue', () => {
    expect(isPresentableBase({ ...base, c: 'burger' })).toBe(true);
  });
  it('écarte la restauration collective', () => {
    expect(isPresentableBase({ ...base, c: 'regional', n: 'Sodexo' })).toBe(false);
    expect(isPresentableBase({ ...base, c: 'regional', n: "Restaurant d'entreprise Airbus" })).toBe(false);
  });
});
