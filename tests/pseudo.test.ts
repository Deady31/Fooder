import { describe, expect, it } from 'vitest';
import {
  PSEUDO_MESSAGES,
  foldForMatch,
  isPseudoForbidden,
  suggestPseudo,
  validatePseudo,
} from '../lib/pseudo';

const ok = (raw: string) => {
  const r = validatePseudo(raw);
  expect(r.ok, `${raw} devrait être accepté`).toBe(true);
  return r.ok ? r.value : '';
};
const ko = (raw: string, reason?: string) => {
  const r = validatePseudo(raw);
  expect(r.ok, `${raw} devrait être refusé`).toBe(false);
  if (!r.ok && reason) expect(r.reason).toBe(reason);
};

describe('validatePseudo : format', () => {
  it('accepte les pseudos classiques', () => {
    expect(ok('Riyan')).toBe('Riyan');
    ok('Léa_42');
    ok('jean-michel');
    ok('foodie.31');
    ok('Zoé');
    ok('Élodie');
    ok('abc');
    ok('a'.repeat(16));
  });

  it('retire les espaces en bordure', () => {
    expect(ok('  Riyan  ')).toBe('Riyan');
  });

  it('refuse vide / null / types invalides', () => {
    ko('', 'empty');
    ko('    ', 'empty');
    ko(null as unknown as string, 'empty');
    ko(undefined as unknown as string, 'empty');
    ko(42 as unknown as string, 'empty');
  });

  it('refuse trop court et trop long (bornes 3 et 16)', () => {
    ko('ab', 'too_short');
    ko('a'.repeat(17), 'too_long');
    ok('abc');
    ok('a'.repeat(16));
  });

  it('refuse les caractères hors jeu autorisé', () => {
    ko('mon pseudo', 'invalid_chars');
    ko('bob<script>', 'invalid_chars');
    ko('bob!', 'invalid_chars');
    ko('bob@mail', 'invalid_chars');
    ko('bob$', 'invalid_chars');
    ko('héros😀', 'invalid_chars');
  });

  it('refuse les alphabets qui imitent le latin (homoglyphes)', () => {
    ko('аdmin', 'invalid_chars'); // « а » cyrillique
    ko('Пример', 'invalid_chars');
  });

  it('refuse les pseudos faits uniquement de séparateurs', () => {
    ko('...', 'invalid_chars');
    ko('___', 'invalid_chars');
    ko('-_-', 'invalid_chars');
  });

  it('compte les accents comme un seul caractère', () => {
    ok('éèà');
  });

  it('message générique identique pour tout refus de contenu, sans révéler le mot', () => {
    const r = validatePseudo('connard');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('unavailable');
      expect(PSEUDO_MESSAGES.unavailable).toBe("Ce pseudo n'est pas disponible, essaie-en un autre");
      expect(PSEUDO_MESSAGES.unavailable.toLowerCase()).not.toContain('connard');
    }
  });

  it('chaque raison a un message', () => {
    for (const k of ['empty', 'too_short', 'too_long', 'invalid_chars', 'unavailable'] as const) {
      expect(PSEUDO_MESSAGES[k].length).toBeGreaterThan(5);
    }
  });
});

describe('foldForMatch', () => {
  it('normalise accents, casse et leetspeak', () => {
    expect(foldForMatch('ÉLODIE')).toContain('elodie');
    expect(foldForMatch('4dm1n')).toContain('admin');
    expect(foldForMatch('f00der')).toContain('fooder');
    expect(foldForMatch('h@ck3r')).toContain('hacker');
    expect(foldForMatch('$ucr3')).toContain('sucre');
    expect(foldForMatch('7op')).toContain('top');
  });

  it('supprime les séparateurs', () => {
    expect(foldForMatch('a d m i n')).toContain('admin');
    expect(foldForMatch('a.d_m-i n')).toContain('admin');
  });

  it('gère 1 comme i et comme l', () => {
    const forms = foldForMatch('1');
    expect(forms).toContain('i');
    expect(forms).toContain('l');
  });
});

describe('noms réservés', () => {
  const reserved = [
    'admin', 'administrateur', 'fooder', 'foodr', 'support', 'moderateur', 'moderator',
    'staff', 'officiel', 'equipe', 'system', 'root', 'null', 'undefined',
  ];
  it.each(reserved)('refuse %s', (name) => {
    ko(name, 'unavailable');
    ko(name.toUpperCase(), 'unavailable');
  });

  it('refuse les variantes accentuées', () => {
    ko('Modérateur', 'unavailable');
    ko('Équipe', 'unavailable');
    ko('Officiel', 'unavailable');
  });

  it('refuse les contournements (leet, séparateurs, chiffres collés)', () => {
    ko('4dm1n', 'unavailable');
    ko('4DM1N', 'unavailable');
    ko('f00der', 'unavailable');
    ko('F00DER', 'unavailable');
    ko('fo0dr', 'unavailable');
    ko('a.d.m.i.n', 'unavailable');
    ko('a_d_m_i_n', 'unavailable');
    ko('a-d-m-i-n', 'unavailable');
    ko('admin92', 'unavailable');
    ko('admiiiin', 'unavailable');
    ko('support_fooder', 'unavailable');
    ko('fooder.officiel', 'unavailable');
    ko('the.admin', 'unavailable');
    ko('m0d3r4t0r', 'unavailable');
    ko('r00t', 'unavailable');
    ko('5ystem', 'unavailable');
    ko('nu11', 'unavailable');
    ko('Ｆｏｏｄｅｒ', 'unavailable'); // pleine chasse
  });

  it('refuse les contournements avec espaces via isPseudoForbidden', () => {
    expect(isPseudoForbidden('a d m i n')).toBe(true);
    expect(isPseudoForbidden('f o o d e r')).toBe(true);
    expect(isPseudoForbidden('4 d m 1 n')).toBe(true);
  });

  it('refuse même quand validatePseudo bloque déjà l’espace', () => {
    ko('a d m i n');
    ko('f o o d e r');
  });

  it('ne bloque pas les mots légitimes qui contiennent un nom réservé', () => {
    ok('badminton');
    ok('Nullepart');
    ok('Rootine');
  });
});

describe('termes refusés : insultes et sexuel', () => {
  const bad = [
    'connard', 'connasse', 'enculé', 'salope', 'putain', 'pute', 'merde', 'bordel',
    'fuck', 'fucker', 'bitch', 'asshole', 'shit', 'cunt', 'whore', 'bastard',
    'porn', 'porno', 'blowjob', 'dildo', 'pussy', 'dickhead', 'ntm', 'fdp',
    'niquer', 'branleur', 'couilles', 'tagueule', 'pedophile', 'violeur', 'sodomie',
  ];
  it.each(bad)('refuse %s', (w) => {
    ko(w, 'unavailable');
    ko(w.toUpperCase(), 'unavailable');
    ko(`${w}42`, 'unavailable');
  });

  it('refuse les variantes leetspeak', () => {
    ko('c0nnard', 'unavailable');
    ko('p0rn', 'unavailable');
    ko('fuuuuck', 'unavailable');
    ko('f.u.c.k', 'unavailable');
    ko('f_u_c_k', 'unavailable');
    ko('b1tch', 'unavailable');
    ko('5alope', 'unavailable');
    ko('put4in', 'unavailable');
    ko('sh1t', 'unavailable');
    ko('m3rd3', 'unavailable');
    ko('encu1er', 'unavailable');
    ko('xX_fuck_Xx', 'unavailable');
    ko('ta-gueule', 'unavailable');
  });

  it('refuse les mots précédés ou suivis de chiffres/séparateurs', () => {
    ko('pute_42', 'unavailable');
    ko('99pute', 'unavailable');
    ko('la.pute', 'unavailable');
    ko('big-dick', 'unavailable');
  });
});

describe('termes refusés : haineux, racistes, discriminatoires', () => {
  const bad = [
    'nigger', 'nigga', 'faggot', 'tranny', 'wetback', 'hitler', 'nazi', 'kkk',
    'bougnoule', 'youpin', 'chintoc', 'negre', 'pede', 'gouine', 'sidaique', 'trisomique',
    'retard', 'spic', 'chink', 'sieg_heil',
  ];
  it.each(bad)('refuse %s', (w) => {
    ko(w, 'unavailable');
    ko(w.toUpperCase(), 'unavailable');
  });

  it('refuse les contournements', () => {
    ko('n1gger', 'unavailable');
    ko('n!gger', 'invalid_chars');
    ko('h1tl3r', 'unavailable');
    ko('adolf.hitler', 'unavailable');
    ko('sale_arabe', 'unavailable');
    ko('sale-noir', 'unavailable');
    ko('n4z1', 'unavailable');
    ko('f4ggot', 'unavailable');
    ko('N.A.Z.I', 'unavailable');
  });
});

describe('absence de faux positifs (problème de Scunthorpe)', () => {
  const fine = [
    'Scunthorpe', 'Classique', 'Pascal', 'Technique', 'Unique', 'Computer', 'Document',
    'Raccoon', 'Violette', 'Violon', 'Nazim', 'Dickens', 'Grape', 'Spice', 'Cocktail',
    'Salopette', 'Pakistan', 'Assis', 'Cassoulet', 'Marie', 'Sophie', 'Lucas', 'Hugo',
    'Camille', 'Thomas', 'Chloe', 'Ratatouille', 'Gourmand', 'Croque-Monsieur', 'Miam_Miam',
    'Chocolat', 'Mélissa', 'Assia', 'Dick', 'Kevin', 'Bastien', 'Cunha', 'Passion', 'Mishit',
  ];
  it.each(fine)('accepte %s', (w) => {
    // « Dick » est un prénom courant, mais volontairement refusé (terme sexuel) : on l'exclut ci-dessous.
    if (w === 'Dick') return;
    ok(w);
  });
  it('refuse Dick (terme sexuel)', () => {
    ko('Dick', 'unavailable');
  });
});

describe('suggestPseudo', () => {
  it('propose toujours un pseudo valide', () => {
    for (let i = 0; i < 300; i++) {
      const s = suggestPseudo();
      expect(validatePseudo(s).ok, s).toBe(true);
    }
  });

  it('est déterministe avec un générateur donné', () => {
    expect(suggestPseudo(() => 0)).toBe(suggestPseudo(() => 0));
  });
});

describe('robustesse', () => {
  it('reste rapide sur une entrée de taille maximale répétée', () => {
    const t = Date.now();
    for (let i = 0; i < 2000; i++) validatePseudo('abcdefghijklmnop');
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it('ne plante pas sur des entrées étranges', () => {
    expect(() => validatePseudo('\u0000\u0001')).not.toThrow();
    expect(() => validatePseudo('á́́b')).not.toThrow();
    expect(() => validatePseudo('x'.repeat(100000))).not.toThrow();
  });
});
