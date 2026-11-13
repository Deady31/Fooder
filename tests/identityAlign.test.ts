import { describe, expect, it } from 'vitest';
import { isAutoPseudo, pickAlignedName } from '../lib/cloud/identityAlign';

describe('isAutoPseudo : pseudo généré automatiquement', () => {
  it('reconnaît foodie42 (trigger SQL) et les pseudos aléatoires locaux', () => {
    expect(isAutoPseudo('foodie42')).toBe(true);
    expect(isAutoPseudo('gourmand77')).toBe(true);
    expect(isAutoPseudo('croqueur10')).toBe(true);
  });
  it('refuse un pseudo choisi', () => {
    expect(isAutoPseudo('Riyan')).toBe(false);
    expect(isAutoPseudo('foodie')).toBe(false);
    expect(isAutoPseudo('foodie_lover')).toBe(false);
    expect(isAutoPseudo('')).toBe(false);
  });
});

describe('pickAlignedName : pseudo conservé à la création de la session', () => {
  it('pseudo choisi à l’onboarding AVANT la session : il l’emporte sur foodie42 du serveur', () => {
    expect(pickAlignedName({ serverName: 'foodie42', localName: 'Riyan', onboardedPseudo: 'Riyan' })).toBe('Riyan');
  });
  it('pseudo renommé après l’onboarding : le nom local actuel l’emporte', () => {
    expect(pickAlignedName({ serverName: 'foodie42', localName: 'Riyan31', onboardedPseudo: 'Riyan' })).toBe('Riyan31');
  });
  it('nouvel appareil, compte existant : le pseudo du serveur reste la référence', () => {
    expect(pickAlignedName({ serverName: 'Riyan', localName: 'foodie55', onboardedPseudo: null })).toBe('Riyan');
    expect(pickAlignedName({ serverName: 'Riyan', localName: 'Autre', onboardedPseudo: 'Autre' })).toBe('Riyan');
  });
  it('onboarding non fait : pas de pseudo choisi, on prend celui du serveur', () => {
    expect(pickAlignedName({ serverName: 'foodie42', localName: 'foodie55', onboardedPseudo: null })).toBe('foodie42');
  });
  it('le nom local est ignoré s’il est lui-même automatique ou vide', () => {
    expect(pickAlignedName({ serverName: 'foodie42', localName: 'foodie55', onboardedPseudo: 'foodie55' })).toBe('foodie42');
    expect(pickAlignedName({ serverName: 'foodie42', localName: '', onboardedPseudo: 'Riyan' })).toBe('foodie42');
  });
  it('profil serveur absent : on garde le nom local', () => {
    expect(pickAlignedName({ serverName: null, localName: 'Riyan', onboardedPseudo: 'Riyan' })).toBe('Riyan');
  });
});
