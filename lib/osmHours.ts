import { DayRanges, WeekHours } from './hours';

const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const toMinutes = (s: string): number | null => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59) return null;
  return h * 60 + mm;
};

function parseDays(spec: string): number[] | null {
  const days = new Set<number>();
  for (const part of spec.split(',')) {
    const bounds = part.trim().split('-');
    const a = DAY_CODES.indexOf(bounds[0]);
    const b = bounds.length > 1 ? DAY_CODES.indexOf(bounds[1]) : a;
    if (a < 0 || b < 0 || bounds.length > 2) return null;
    for (let i = a; ; i = (i + 1) % 7) {
      days.add(i);
      if (i === b) break;
    }
  }
  return Array.from(days);
}

function parseRanges(spec: string): DayRanges | null {
  const ranges: DayRanges = [];
  for (const part of spec.split(',')) {
    const [from, to] = part.trim().split('-');
    const a = from ? toMinutes(from) : null;
    let b = to ? toMinutes(to) : null;
    if (a === null || b === null) return null;
    if (b <= a) b += 1440;
    ranges.push([a, b]);
  }
  return ranges;
}

/**
 * Convertit un sous-ensemble courant du format OSM `opening_hours`
 * (ex. "Mo-Sa 12:00-14:00,19:00-22:30; Su off", "24/7").
 * Renvoie undefined si la syntaxe n'est pas reconnue (jamais d'horaires faux).
 */
export function parseOsmHours(raw: string | undefined | null): WeekHours | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (text === '24/7') return Array.from({ length: 7 }, () => [[0, 1440]] as DayRanges);

  const week: WeekHours = Array.from({ length: 7 }, () => []);
  let filled = false;
  for (const rule of text.split(';')) {
    const r = rule.trim();
    if (!r) continue;
    const m = r.match(/^([A-Za-z,-]+)\s+(.+)$/);
    if (!m) return undefined;
    const days = parseDays(m[1]);
    if (!days) return undefined;
    if (m[2].trim() === 'off') {
      days.forEach(d => (week[d] = []));
      continue;
    }
    const ranges = parseRanges(m[2]);
    if (!ranges) return undefined;
    days.forEach(d => (week[d] = ranges));
    filled = true;
  }
  return filled ? week : undefined;
}
