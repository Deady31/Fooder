export type DayRanges = [number, number][];
export type WeekHours = DayRanges[];

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as const;

export const todayIndex = (d: Date = new Date()): number => (d.getDay() + 6) % 7;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(minutes: number): string {
  const m = minutes % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${pad(mm)}`;
}

export function formatDay(ranges: DayRanges): string {
  if (ranges.length === 0) return 'Fermé';
  return ranges.map(([a, b]) => `${formatTime(a)} – ${formatTime(b)}`).join('  ·  ');
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

export function openStatus(week: WeekHours, now: Date = new Date()): OpenStatus {
  const day = todayIndex(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  const yesterday = week[(day + 6) % 7] ?? [];
  for (const [, b] of yesterday) {
    if (b > 1440 && minutes < b - 1440) return { open: true, label: `Ouvert · ferme à ${formatTime(b)}` };
  }

  for (const [a, b] of week[day] ?? []) {
    if (minutes >= a && minutes < b) return { open: true, label: `Ouvert · ferme à ${formatTime(b)}` };
    if (minutes < a) return { open: false, label: `Fermé · ouvre à ${formatTime(a)}` };
  }

  for (let i = 1; i <= 7; i++) {
    const next = week[(day + i) % 7] ?? [];
    if (next.length > 0) {
      const when = i === 1 ? 'demain' : DAY_SHORT[(day + i) % 7];
      return { open: false, label: `Fermé · ouvre ${when} à ${formatTime(next[0][0])}` };
    }
  }
  return { open: false, label: 'Fermé' };
}

interface GooglePeriodPoint {
  day: number;
  time?: string;
  hours?: number;
  minutes?: number;
}

interface GooglePeriod {
  open: GooglePeriodPoint;
  close?: GooglePeriodPoint;
}

const pointMinutes = (p: GooglePeriodPoint): number =>
  typeof p.hours === 'number' ? p.hours * 60 + (p.minutes ?? 0) : p.time ? Number(p.time.slice(0, 2)) * 60 + Number(p.time.slice(2, 4)) : 0;

export function weekFromGooglePeriods(periods?: GooglePeriod[]): WeekHours | undefined {
  if (!periods || periods.length === 0) return undefined;
  const week: WeekHours = Array.from({ length: 7 }, () => []);

  if (periods.length === 1 && !periods[0].close) {
    return week.map(() => [[0, 1440]] as DayRanges);
  }

  for (const p of periods) {
    if (!p.close) continue;
    const day = (p.open.day + 6) % 7;
    const start = pointMinutes(p.open);
    let end = pointMinutes(p.close);
    if (p.close.day !== p.open.day || end <= start) end += 1440;
    week[day].push([start, end]);
  }
  week.forEach(r => r.sort((x, y) => x[0] - y[0]));
  return week;
}
