import type { DayRanges, WeekHours } from './hours';

/**
 * Parseur pur de la syntaxe OSM `opening_hours` courante.
 * Principe : mieux vaut « inconnu » (null / undefined) qu'un horaire faux.
 * Les jours fériés (PH) et vacances scolaires (SH) sont ignorés.
 */

const DAY_CODES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const DAY = '(mo|tu|we|th|fr|sa|su)';
const TIME = '(\\d{1,2}):(\\d{2})';

type Token =
  | { t: 'range'; a: number; b: number }
  | { t: 'days'; days: number[] }
  | { t: 'holiday' }
  | { t: 'off' }
  | { t: 'unknown' }
  | { t: 'sep'; sep: ';' | ',' }
  | { t: 'all' };

const toMinutes = (h: string, m: string): number | null => {
  const hh = Number(h);
  const mm = Number(m);
  if (mm > 59 || hh > 24 || (hh === 24 && mm !== 0)) return null;
  return hh * 60 + mm;
};

function daysBetween(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; ; i = (i + 1) % 7) {
    out.push(i);
    if (i === b) break;
  }
  return out;
}

const PATTERNS: [RegExp, (m: RegExpMatchArray) => Token | null][] = [
  [/^24\/7/, () => ({ t: 'all' })],
  [
    new RegExp(`^${TIME}\\s*-\\s*${TIME}`),
    m => {
      const a = toMinutes(m[1], m[2]);
      let b = toMinutes(m[3], m[4]);
      if (a === null || b === null) return null;
      if (b <= a) b += 1440;
      return { t: 'range', a, b };
    },
  ],
  [new RegExp(`^${DAY}\\s*-\\s*${DAY}(?![a-z])`, 'i'), m => ({ t: 'days', days: daysBetween(DAY_CODES.indexOf(m[1].toLowerCase()), DAY_CODES.indexOf(m[2].toLowerCase())) })],
  [new RegExp(`^${DAY}(?![a-z])`, 'i'), m => ({ t: 'days', days: [DAY_CODES.indexOf(m[1].toLowerCase())] })],
  [/^(?:ph|sh)(?![a-z])/i, () => ({ t: 'holiday' })],
  [/^(?:off|closed)(?![a-z])/i, () => ({ t: 'off' })],
  [/^unknown(?![a-z])/i, () => ({ t: 'unknown' })],
  [/^[;,]/, m => ({ t: 'sep', sep: m[0] as ';' | ',' })],
];

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < text.length) {
    if (/\s/.test(text[pos])) {
      pos++;
      continue;
    }
    let matched = false;
    const rest = text.slice(pos);
    for (const [re, build] of PATTERNS) {
      const m = rest.match(re);
      if (!m) continue;
      const tok = build(m);
      if (!tok) return null;
      tokens.push(tok);
      pos += m[0].length;
      matched = true;
      break;
    }
    if (!matched) return null; // commentaire, "sunrise", "+", "||", etc.
  }
  return tokens;
}

interface Rule {
  days: Set<number>;
  holiday: boolean;
  ranges: DayRanges;
  off: boolean;
  unknown: boolean;
  additive: boolean;
}

const newRule = (additive: boolean): Rule => ({ days: new Set(), holiday: false, ranges: [], off: false, unknown: false, additive });

const emptyWeek = (): WeekHours => Array.from({ length: 7 }, () => [] as DayRanges);

/** Applique une règle ; renvoie false si elle est invalide. */
function applyRule(week: WeekHours, rule: Rule): boolean {
  const hasContent = rule.days.size > 0 || rule.holiday || rule.ranges.length > 0 || rule.off || rule.unknown;
  if (!hasContent) return true;
  if (rule.days.size === 0 && rule.holiday) return true; // règle réservée aux jours fériés : ignorée
  if (rule.unknown) return false;
  if (!rule.off && rule.ranges.length === 0) return false; // « Mo-Sa » seul : on ne devine pas
  const days = rule.days.size > 0 ? Array.from(rule.days) : [0, 1, 2, 3, 4, 5, 6];
  for (const d of days) {
    if (rule.off) week[d] = [];
    else if (rule.additive) week[d] = [...week[d], ...rule.ranges];
    else week[d] = rule.ranges;
  }
  return true;
}

/** Convertit une chaîne opening_hours en semaine de plages (minutes) ; undefined si non comprise. */
export function parseOpeningHours(raw: string | undefined | null): WeekHours | undefined {
  if (!raw || !raw.trim()) return undefined;
  const tokens = tokenize(raw);
  if (!tokens || tokens.length === 0) return undefined;

  if (tokens.length === 1 && tokens[0].t === 'all') return Array.from({ length: 7 }, () => [[0, 1440]] as DayRanges);

  const week = emptyWeek();
  let rule = newRule(false);
  let anyRange = false;
  const flush = (additiveNext: boolean): boolean => {
    const ok = applyRule(week, rule);
    rule = newRule(additiveNext);
    return ok;
  };

  for (const tok of tokens) {
    switch (tok.t) {
      case 'all':
        return undefined; // « 24/7 » mêlé à d'autres règles : trop ambigu
      case 'sep':
        if (tok.sep === ';' && !flush(false)) return undefined;
        break;
      case 'days':
      case 'holiday':
        if (rule.ranges.length > 0 || rule.off) {
          if (!flush(true)) return undefined; // « …, Sa 12:00-14:00 » : nouvelle règle
        }
        if (tok.t === 'days') tok.days.forEach(d => rule.days.add(d));
        else rule.holiday = true;
        break;
      case 'range':
        if (rule.off) return undefined;
        rule.ranges = [...rule.ranges, [tok.a, tok.b]];
        if (rule.days.size > 0 || !rule.holiday) anyRange = true;
        break;
      case 'off':
        rule.off = true;
        break;
      case 'unknown':
        rule.unknown = true;
        break;
    }
  }
  if (!flush(false)) return undefined;
  return anyRange ? week : undefined;
}

const cache = new Map<string, WeekHours | undefined>();

function resolve(h: string | WeekHours | null | undefined): WeekHours | undefined {
  if (!h) return undefined;
  if (typeof h !== 'string') return h.length === 7 ? h : undefined;
  if (cache.has(h)) return cache.get(h);
  const week = parseOpeningHours(h);
  if (cache.size > 5000) cache.clear();
  cache.set(h, week);
  return week;
}

/** Plage ouverte contenant `date` : [début, fin] en minutes depuis 00:00 du jour de `date`. */
function currentSpan(week: WeekHours, date: Date): [number, number] | null {
  const today = (date.getDay() + 6) % 7;
  const now = date.getHours() * 60 + date.getMinutes();
  const spans: [number, number][] = [];
  for (let k = -1; k <= 7; k++) {
    const day = (((today + k) % 7) + 7) % 7;
    for (const [a, b] of week[day] ?? []) spans.push([k * 1440 + a, k * 1440 + b]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged.find(([a, b]) => a <= now && now < b) ?? null;
}

/** true / false, ou null si les horaires sont inconnus ou non lisibles. */
export function isOpenAt(h: string | WeekHours | null | undefined, date: Date): boolean | null {
  const week = resolve(h);
  if (!week) return null;
  return currentSpan(week, date) !== null;
}

/** Heure de fermeture (« HH:MM ») de la plage en cours ; null si fermé, inconnu ou ouvert 24 h/24. */
export function closesAt(h: string | WeekHours | null | undefined, date: Date): string | null {
  const week = resolve(h);
  if (!week) return null;
  const span = currentSpan(week, date);
  if (!span) return null;
  const now = date.getHours() * 60 + date.getMinutes();
  if (span[1] - now >= 6 * 1440) return null;
  const end = span[1] % 1440;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** « 22:00 » -> « 22 h », « 22:30 » -> « 22 h 30 », « 00:00 » -> « minuit ». */
export function formatCloseTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === 0 && m === 0) return 'minuit';
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const PARIS_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

/**
 * Date dont les composantes locales (getDay, getHours…) valent l'heure murale de Paris à l'instant `date`.
 * À utiliser côté serveur (fuseau UTC) avant isOpenAt / closesAt.
 */
export function parisWallClock(date: Date): Date {
  const p: Record<string, number> = {};
  for (const part of PARIS_FORMAT.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute);
}
