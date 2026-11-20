import { describe, expect, it } from 'vitest';
import { addressIssues, clusterByName, coherence, nameKey, parseAddress, sameVenue } from '../scripts/lib/addressAudit.mjs';

const at = (id: string, n: string, la: number, ln: number) => ({ id, n, la, ln });

describe('audit des adresses : lecture d’une adresse', () => {
  it('reconnaît numéro, code postal et commune', () => {
    expect(parseAddress('269 La Méridienne, 31670, Labège')).toEqual({ present: true, hasNumber: true, postcode: '31670', commune: 'Labège' });
    expect(parseAddress("2 Route d'Espagne, 31100, Toulouse")).toMatchObject({ hasNumber: true, postcode: '31100', commune: 'Toulouse' });
  });

  it('trouve le numéro même quand il n’est pas dans le premier segment', () => {
    expect(parseAddress('Centre Commercial Gramont, 2 Chem. de Gabardie, 31200, Toulouse').hasNumber).toBe(true);
  });

  it('lit une plage de numéros (13/14) et ne la compte pas comme un conflit', () => {
    expect(parseAddress('13/14 Chemin du Logis Vieux, 31850').hasNumber).toBe(true);
    expect(coherence('13/14 Chemin du Logis Vieux, 31850', '14 Chemin du Logis Vieux, 31850')).toBe('ok');
  });

  it('un code postal à 5 chiffres n’est pas un numéro de rue', () => {
    expect(parseAddress('Rue des Lois, 31000, Toulouse').hasNumber).toBe(false);
  });

  it('distingue adresse absente, sans numéro, sans code postal', () => {
    expect(addressIssues('')).toEqual(['sans_adresse']);
    expect(addressIssues(undefined)).toEqual(['sans_adresse']);
    expect(addressIssues('Avenue du Mirail, Toulouse')).toEqual(['sans_numero', 'sans_code_postal']);
    expect(addressIssues('21 Avenue du Général Compans')).toEqual(['sans_code_postal', 'sans_commune']);
    expect(addressIssues('12 Rue Lafayette, 31000, Toulouse')).toEqual([]);
  });

  it('un nom de voie en dernier segment n’est pas pris pour une commune', () => {
    expect(parseAddress('Zone Industrielle, Rue des Frères Lumière').commune).toBeNull();
  });
});

describe('audit des adresses : cohérence OSM / Overture', () => {
  it('ok, incomplet et conflits', () => {
    expect(coherence('12 Rue A, 31000, Toulouse', '12 rue A, 31000 Toulouse')).toBe('ok');
    expect(coherence('', '12 rue A, 31000')).toBe('incomplet');
    expect(coherence('12 Rue A, 31000, Toulouse', '14 Rue A, 31000, Toulouse')).toBe('conflit_numero');
    expect(coherence('12 Rue A, 31000, Toulouse', '12 Rue A, 31300, Toulouse')).toBe('conflit_code_postal');
  });
});

describe('audit des adresses : noms et doublons', () => {
  it('compare les noms sans accents ni mots vides', () => {
    expect(nameKey('Le Café de l’Été')).toBe(nameKey('ete'));
    expect(nameKey('Restaurant La Bonita')).toBe('bonita');
  });

  it('même nom à 50 m ou moins : doublon ; au-delà : agences distinctes', () => {
    const list = [
      at('a1', 'Tasty Crousty', 43.606, 1.4425),
      at('a2', 'Tasty Crousty', 43.60601, 1.44251), // quelques mètres : doublon
      at('b1', 'Tasty Crousty', 43.5808, 1.4246), // autre quartier : autre agence
      at('c1', 'Crousty One', 43.6077, 1.447),
    ];
    const { duplicates, chains } = clusterByName(list, 50);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].ids.sort()).toEqual(['a1', 'a2']);
    expect(chains).toHaveLength(1);
    expect(chains[0].agencies).toBe(2);
  });

  it('un nom unique n’est ni doublon ni chaîne', () => {
    expect(clusterByName([at('x', 'Seul', 43.6, 1.44)])).toEqual({ duplicates: [], chains: [] });
  });

  it('même lieu : noms compatibles et moins de 70 m', () => {
    expect(sameVenue(at('a', 'La Bonita', 43.5909, 1.4396), at('b', 'Bonita', 43.59095, 1.43965))).toBe(true);
    expect(sameVenue(at('a', 'La Bonita', 43.5909, 1.4396), at('b', 'Bonita', 43.6, 1.45))).toBe(false);
  });
});
