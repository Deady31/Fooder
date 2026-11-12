/**
 * Mise en forme des métriques du backoffice (fonctions pures, partagées client / serveur).
 * Les chiffres bruts viennent des fonctions SQL admin_* (supabase/migrations/20261113000000_tracking.sql).
 */

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** Funnel par défaut : ouverture → swipe → like → fiche ouverte → « J'y suis allé ». */
export const DEFAULT_FUNNEL = ['session_start', 'swipe', 'swipe_like', 'open_card', 'checkin'];

const STEP_RE = /^[a-z0-9_]{2,40}(:\/[A-Za-z0-9_\-/[\]]{0,80})?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDays(v: unknown): Period {
  const n = Number(v);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

/** « a,b,c » → étapes valides (2 à 8), sinon null. Une étape peut viser un écran : « screen_view:/swipe ». */
export function parseSteps(v: unknown): string[] | null {
  if (typeof v !== 'string') return null;
  const steps = v.split(',').map(s => s.trim()).filter(Boolean);
  if (steps.length < 2 || steps.length > 8 || !steps.every(s => STEP_RE.test(s))) return null;
  return steps;
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

export function rate(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

export function formatPct(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return '—';
  const p = r * 100;
  const s = Number.isInteger(Math.round(p * 10) / 10) ? String(Math.round(p)) : (Math.round(p * 10) / 10).toFixed(1).replace('.', ',');
  return `${s} %`;
}

export function formatNumber(n: unknown): string {
  return new Intl.NumberFormat('fr-FR').format(num(n));
}

export function formatDuration(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s) || s < 0) return '—';
  const t = Math.round(s);
  if (t < 60) return `${t} s`;
  if (t < 3600) return `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, '0')} s`;
  return `${Math.floor(t / 3600)} h ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')} min`;
}

// ───────── Libellés ─────────

const EVENT_LABELS: Record<string, string> = {
  session_start: 'Ouverture de l’appli',
  session_end: 'Fin de session',
  screen_view: 'Écran affiché',
  heartbeat: 'Temps actif',
  click: 'Clic',
  swipe: 'Swipe',
  swipe_like: 'A liké un resto',
  swipe_pass: 'A passé un resto',
  open_card: 'A ouvert une fiche',
  checkin: 'J’y suis allé',
  visit_confirmed: 'Visite confirmée',
  photo_posted: 'Photo publiée',
  post_published: 'Post publié',
  friend_added: 'Ami ajouté',
  friend_link_shared: 'Lien d’ami partagé',
  friend_card_shared: 'Carte partagée',
  group_created: 'Groupe créé',
  group_joined: 'Groupe rejoint',
  group_voted: 'Vote de groupe',
  share: 'Partage',
  signup: 'Compte sauvegardé',
  auth_code_sent: 'Code e-mail demandé',
  auth_signed_in: 'Connexion e-mail',
  defi_sent: 'Défi envoyé',
  defi_received: 'Défi reçu',
};

const SHORT_LABELS: Record<string, string> = {
  session_start: 'Ouverture',
  swipe: 'Swipe',
  swipe_like: 'Like',
  swipe_pass: 'Passe',
  open_card: 'Fiche ouverte',
  checkin: 'J’y suis allé',
  screen_view: 'Écran',
  signup: 'Compte',
  friend_added: 'Ami ajouté',
  group_joined: 'Groupe',
  share: 'Partage',
  photo_posted: 'Photo',
};

export function stepLabel(step: string): string {
  const [name, screen] = step.split(':');
  const base = SHORT_LABELS[name] ?? EVENT_LABELS[name] ?? name;
  return screen ? `${base} ${screen}` : base;
}

export function describeEvent(name: string, props: Record<string, unknown> = {}): string {
  if (name === 'click' && typeof props.label === 'string') return `Clic « ${props.label} »`;
  return EVENT_LABELS[name] ?? name;
}

// ───────── Funnel ─────────

export interface FunnelRaw {
  step: number;
  step_name: string;
  users: number;
  median_s: number | null;
}

export interface FunnelStep {
  name: string;
  label: string;
  users: number;
  /** Conversion depuis l'étape précédente (1 pour la première, null si l'étape précédente est vide). */
  fromPrev: number | null;
  fromStart: number | null;
  dropped: number;
  medianS: number | null;
}

export function buildFunnel(rows: readonly FunnelRaw[]): FunnelStep[] {
  const sorted = [...rows].sort((a, b) => num(a.step) - num(b.step));
  const first = sorted.length ? num(sorted[0].users) : 0;
  return sorted.map((r, i) => {
    const users = num(r.users);
    const prev = i === 0 ? users : num(sorted[i - 1].users);
    return {
      name: r.step_name,
      label: stepLabel(r.step_name),
      users,
      fromPrev: i === 0 ? (users > 0 ? 1 : null) : rate(users, prev),
      fromStart: rate(users, first),
      dropped: i === 0 ? 0 : Math.max(0, prev - users),
      medianS: r.median_s === null || r.median_s === undefined ? null : num(r.median_s),
    };
  });
}

// ───────── Rétention ─────────

export interface RetentionRaw {
  cohort: string;
  size: number;
  d1: number;
  d1_eligible: number;
  d7: number;
  d7_eligible: number;
  d30: number;
  d30_eligible: number;
}

export interface RetentionCell {
  n: number;
  eligible: number;
  rate: number | null;
}

export interface RetentionRow {
  cohort: string;
  size: number;
  d1: RetentionCell;
  d7: RetentionCell;
  d30: RetentionCell;
}

const cell = (n: unknown, eligible: unknown): RetentionCell => ({ n: num(n), eligible: num(eligible), rate: rate(num(n), num(eligible)) });

function retentionTotals(rows: readonly RetentionRow[]): RetentionRow {
  const sum = (k: 'd1' | 'd7' | 'd30') =>
    cell(
      rows.reduce((a, r) => a + r[k].n, 0),
      rows.reduce((a, r) => a + r[k].eligible, 0)
    );
  return { cohort: 'total', size: rows.reduce((a, r) => a + r.size, 0), d1: sum('d1'), d7: sum('d7'), d30: sum('d30') };
}

/** Cohortes les plus récentes d'abord ; un taux n'est calculé que sur les utilisateurs assez anciens (éligibles). */
export const buildRetention = Object.assign(
  (rows: readonly RetentionRaw[]): RetentionRow[] =>
    [...rows]
      .map(r => ({ cohort: String(r.cohort).slice(0, 10), size: num(r.size), d1: cell(r.d1, r.d1_eligible), d7: cell(r.d7, r.d7_eligible), d30: cell(r.d30, r.d30_eligible) }))
      .sort((a, b) => (a.cohort < b.cohort ? 1 : a.cohort > b.cohort ? -1 : 0)),
  { totals: retentionTotals }
);
