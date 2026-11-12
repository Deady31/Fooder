/**
 * Validation des pseudos : format, noms réservés, termes refusés.
 * Fonctions pures, sans dépendance. Le mot filtré n'est jamais renvoyé à l'appelant.
 */

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 16;

export type PseudoRefusal = 'empty' | 'too_short' | 'too_long' | 'invalid_chars' | 'unavailable';

export type PseudoResult =
  | { ok: true; value: string; reason?: undefined }
  | { ok: false; reason: PseudoRefusal; value?: undefined };

export const PSEUDO_MESSAGES: Record<PseudoRefusal, string> = {
  empty: 'Il nous faut un pseudo pour continuer',
  too_short: `Ton pseudo doit faire au moins ${PSEUDO_MIN} caractères`,
  too_long: `Ton pseudo doit faire ${PSEUDO_MAX} caractères maximum`,
  invalid_chars: 'Lettres, chiffres, point, tiret et underscore uniquement (pas d’espaces)',
  unavailable: "Ce pseudo n'est pas disponible, essaie-en un autre",
};

/* ── Normalisation ───────────────────────────────────────────────── */

const LEET: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** NFKD, minuscules, sans diacritiques. */
function fold(raw: string): string {
  return raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const lettersOnly = (s: string): string => s.replace(/[^a-z]/g, '');

/** Formes « lettres seules » d'un texte déjà plié : leetspeak (1 lu i ou l) ou chiffres ignorés. */
function variantsOfFolded(s: string): string[] {
  const out = new Set<string>();
  for (const one of ['i', 'l']) {
    let mapped = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      mapped += c === '1' ? one : (LEET[c] ?? c);
    }
    out.add(lettersOnly(mapped));
  }
  out.add(lettersOnly(s));
  out.delete('');
  return Array.from(out);
}

/**
 * Formes normalisées d'un texte pour la comparaison : accents, casse, séparateurs et
 * leetspeak (0→o 1→i/l 3→e 4→a 5→s 7→t @→a $→s) neutralisés.
 */
export function foldForMatch(raw: string): string[] {
  return variantsOfFolded(fold(raw));
}

const collapse = (s: string): string => s.replace(/(.)\1+/g, '$1');
const squeeze = (s: string): string => s.replace(/(.)\1{2,}/g, '$1$1');

/* ── Listes ──────────────────────────────────────────────────────── */

/** Noms réservés : refusés s'ils sont égaux, ou (marques et rôles distinctifs) en début/fin. */
const RESERVED_EXACT = ['support', 'staff', 'equipe', 'system', 'root', 'null', 'undefined'];
const RESERVED_EDGE = ['admin', 'administrateur', 'moderateur', 'moderator', 'officiel'];
const RESERVED_ANYWHERE = ['fooder', 'foodr'];

/** Termes refusés où qu'ils apparaissent (assez longs et spécifiques pour éviter les faux positifs). */
const STRONG = [
  // FR
  'connard', 'connasse', 'conasse', 'enculer', 'encule', 'putain', 'merde', 'bordel', 'salaud',
  'enfoire', 'niquer', 'niquetamere', 'tagueule', 'branleur', 'branler', 'couille', 'foutre',
  'pouffiasse', 'grognasse', 'gouine', 'tarlouze', 'bougnoule', 'youpin', 'chintoc', 'niakoue',
  'pedophile', 'violeur', 'violer', 'sodomie', 'fellation', 'masturb', 'orgasme', 'sperme',
  'sidaique', 'trisomique', 'bukkake', 'penis', 'vagina', 'clitoris', 'hitler', 'siegheil', 'heilhitler',
  'salearabe', 'salenoir', 'salenegre', 'salejuif', 'salechinois', 'salepede',
  // EN
  'fuck', 'bitch', 'asshole', 'bastard', 'whore', 'pussy', 'dickhead', 'motherfucker', 'nigger', 'nigga',
  'faggot', 'tranny', 'wetback', 'porn', 'blowjob', 'handjob', 'cumshot', 'dildo', 'rapist', 'bullshit',
  'shitty', 'cocksucker', 'jerkoff',
];

/**
 * Termes courts ou qui se trouvent dans des mots courants (technique, computer, salopette...) :
 * refusés seulement s'ils forment un mot entier (ou son pluriel).
 */
const WEAK = [
  // FR
  'pute', 'salope', 'con', 'cons', 'cul', 'bite', 'zob', 'chatte', 'nique', 'ntm', 'fdp', 'pd', 'pede',
  'pedale', 'lopette', 'tapette', 'batard', 'negre', 'negro', 'bicot', 'bamboula', 'feuj', 'mongol',
  'mongolien', 'attarde', 'debile', 'cretin', 'abruti', 'sexe', 'sex', 'nichon', 'jouir', 'baise',
  'nazi', 'pedo', 'viol',
  // EN
  'shit', 'ass', 'dick', 'cock', 'cunt', 'slut', 'fag', 'retard', 'retarded', 'rape', 'chink', 'spic',
  'kike', 'coon', 'paki', 'dyke', 'kkk', 'cum', 'anal', 'boob', 'tit', 'tits',
];

/** Mots légitimes qui contiennent un terme refusé : retirés avant la recherche de sous-chaînes. */
const SAFE_WORDS = ['nigeria', 'nigerien', 'nigerian', 'niger', 'pornic', 'pornichet'];

/** Termes dont la version « lettres doublées réduites » créerait des mots courants (niger, fagot...). */
const NO_COLLAPSE = new Set(['nigger', 'nigga', 'faggot', 'tranny', 'asshole']);

const collapsible = (term: string): string | null => {
  const c = collapse(term);
  return !NO_COLLAPSE.has(term) && c.length >= 4 ? c : null;
};

interface Matcher {
  term: string;
  collapsed: string | null;
}
const compile = (terms: string[]): Matcher[] => terms.map(term => ({ term, collapsed: collapsible(term) }));
const compileWithSelf = (terms: string[]): Matcher[] =>
  terms.map(term => ({ term, collapsed: collapse(term).length >= 4 ? collapse(term) : null }));

const STRONG_M = compile(STRONG);
const WEAK_M = compile(WEAK);
const EXACT_M = compileWithSelf(RESERVED_EXACT);
const EDGE_M = compileWithSelf(RESERVED_EDGE);
const ANY_M = compileWithSelf(RESERVED_ANYWHERE);

/** Variantes d'une forme : brute, séries ≥3 ramenées à 2, séries réduites à 1. */
function expand(form: string): { raw: string[]; single: string } {
  return { raw: [form, squeeze(form)], single: collapse(form) };
}

function hitsEquals(form: string, ms: Matcher[], plural: boolean): boolean {
  const { raw, single } = expand(form);
  return ms.some(m => {
    if (raw.some(r => r === m.term || (plural && r === `${m.term}s`))) return true;
    return m.collapsed !== null && (single === m.collapsed || (plural && single === `${m.collapsed}s`));
  });
}

function hitsIncludes(form: string, ms: Matcher[]): boolean {
  const { raw, single } = expand(form);
  return ms.some(m => raw.some(r => r.includes(m.term)) || (m.collapsed !== null && single.includes(m.collapsed)));
}

function hitsEdges(form: string, ms: Matcher[]): boolean {
  const { raw, single } = expand(form);
  return ms.some(m => {
    if (raw.some(r => r.startsWith(m.term) || r.endsWith(m.term))) return true;
    return m.collapsed !== null && (single.startsWith(m.collapsed) || single.endsWith(m.collapsed));
  });
}

const stripSafe = (form: string): string => SAFE_WORDS.reduce((s, w) => s.split(w).join(''), form);

/** Vrai si le texte (espaces et séparateurs compris) est réservé ou contient un terme refusé. */
export function isPseudoForbidden(raw: string): boolean {
  const folded = fold(raw);
  const whole = variantsOfFolded(folded);
  const tokens = folded.split(/[^a-z0-9@$]+/).filter(Boolean);
  const tokenForms = tokens.flatMap(variantsOfFolded);
  const all = [...whole, ...tokenForms];

  if (whole.some(f => hitsIncludes(f, ANY_M) || hitsEdges(f, EDGE_M))) return true;
  if (all.some(f => hitsEquals(f, EXACT_M, false) || hitsEquals(f, EDGE_M, false) || hitsIncludes(f, ANY_M))) return true;
  if (whole.some(f => hitsIncludes(stripSafe(f), STRONG_M))) return true;
  return all.some(f => hitsEquals(f, WEAK_M, true));
}

/* ── Validation ──────────────────────────────────────────────────── */

// Construit à l'exécution : la cible TS est ES5, les propriétés Unicode demandent le drapeau « u ».
const ALLOWED = new RegExp('^[\\p{Script=Latin}0-9._-]+$', 'u');

export function validatePseudo(raw: unknown): PseudoResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'empty' };
  const length = Array.from(value).length;
  if (length < PSEUDO_MIN) return { ok: false, reason: 'too_short' };
  if (length > PSEUDO_MAX) return { ok: false, reason: 'too_long' };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'invalid_chars' };
  if (value.replace(/[._-]/g, '').length < 2) return { ok: false, reason: 'invalid_chars' };
  if (isPseudoForbidden(value)) return { ok: false, reason: 'unavailable' };
  return { ok: true, value };
}

/* ── Suggestion ──────────────────────────────────────────────────── */

const NOUNS = ['Ramen', 'Pizza', 'Taco', 'Sushi', 'Burger', 'Crepe', 'Pasta', 'Tartine', 'Brioche', 'Falafel'];
const ADJS = ['Joyeux', 'Rapide', 'Epice', 'Fondu', 'Malin', 'Zen', 'Doux', 'Fou'];

/** Pseudo rigolo prêt à l'emploi (toujours valide). */
export function suggestPseudo(rand: () => number = Math.random): string {
  const pick = <T,>(list: T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const n = Math.min(99, Math.floor(rand() * 90) + 10);
  return `${pick(NOUNS)}${pick(ADJS)}${n}`;
}
