/**
 * Onglet « Utilisateurs » du backoffice : paramètres, validation des réponses SQL, libellés (fonctions pures, tests/adminUsers.test.ts).
 * Les chiffres viennent de admin_users / admin_devices (supabase/migrations/20261115000000_admin_users.sql).
 * Rien n'est inventé : une réponse vide ou illisible donne zéro utilisateur. L'adresse e-mail n'est jamais lue ni renvoyée.
 */
import { PERIODS, isUuid, parseDays } from './metrics';

export const PAGE_SIZE = 25;
export const MAX_PAGE = 1000;
export const MAX_QUERY = 40;
export const MAX_PSEUDO = 20;

export type DeviceDimension = 'platform' | 'browser' | 'form' | 'installed';

const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux', autre: 'Autre' };
const BROWSER_LABEL: Record<string, string> = {
  chrome: 'Chrome',
  safari: 'Safari',
  firefox: 'Firefox',
  edge: 'Edge',
  samsung: 'Samsung Internet',
  instagram: 'Instagram (intégré)',
  facebook: 'Facebook (intégré)',
  tiktok: 'TikTok (intégré)',
  autre: 'Autre',
};
const FORM_LABEL: Record<string, string> = { mobile: 'Mobile', tablette: 'Tablette', ordinateur: 'Ordinateur' };
const INSTALLED_LABEL: Record<string, string> = { installee: 'Appli installée', navigateur: 'Dans le navigateur' };

const LABELS: Record<DeviceDimension, Record<string, string>> = { platform: PLATFORM_LABEL, browser: BROWSER_LABEL, form: FORM_LABEL, installed: INSTALLED_LABEL };

export interface UsersQuery {
  page: number;
  q: string;
  days: (typeof PERIODS)[number];
}

export function parseUsersQuery(params: URLSearchParams): UsersQuery {
  const n = Math.floor(Number(params.get('page')));
  const page = Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_PAGE) : 1;
  const q = (params.get('q') ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_QUERY)
    .trim();
  return { page, q, days: parseDays(params.get('days')) };
}

export interface UserRow {
  user_id: string;
  pseudo: string | null;
  account_exists: boolean;
  is_anonymous: boolean;
  has_email: boolean;
  first_seen: string | null;
  last_seen: string | null;
  sessions: number;
  active_s: number;
  platform: string | null;
  form: string | null;
  browser: string | null;
  installed: boolean | null;
  likes: number;
  passes: number;
  opens: number;
  checkins: number;
  posts: number;
  photos: number;
}

export interface UsersPayload {
  total: number;
  rows: UserRow[];
}

export interface DeviceShare {
  key: string;
  users: number;
}

export interface DevicesPayload {
  users: number;
  platforms: DeviceShare[];
  browsers: DeviceShare[];
  forms: DeviceShare[];
  installed: DeviceShare[];
}

/** Réponse de /api/admin/users. */
export interface UsersResponse {
  page: number;
  q: string;
  days: number;
  users: UsersPayload;
  devices: DevicesPayload;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const inList = (v: unknown, labels: Record<string, string>): string | null => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(labels, v) ? v : null);
const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

function toUserRow(raw: unknown): UserRow | null {
  if (!isObj(raw) || !isUuid(raw.user_id)) return null;
  const pseudo = typeof raw.pseudo === 'string' && raw.pseudo.trim() ? raw.pseudo.trim().slice(0, MAX_PSEUDO) : null;
  return {
    user_id: raw.user_id.toLowerCase(),
    pseudo,
    account_exists: raw.account_exists !== false,
    is_anonymous: raw.is_anonymous === true,
    has_email: raw.has_email === true,
    first_seen: isoOrNull(raw.first_seen),
    last_seen: isoOrNull(raw.last_seen),
    sessions: count(raw.sessions),
    active_s: count(raw.active_s),
    platform: inList(raw.platform, PLATFORM_LABEL),
    form: inList(raw.form, FORM_LABEL),
    browser: inList(raw.browser, BROWSER_LABEL),
    installed: typeof raw.installed === 'boolean' ? raw.installed : null,
    likes: count(raw.likes),
    passes: count(raw.passes),
    opens: count(raw.opens),
    checkins: count(raw.checkins),
    posts: count(raw.posts),
    photos: count(raw.photos),
  };
}

export function normalizeUsers(raw: unknown): UsersPayload {
  if (!isObj(raw) || !Array.isArray(raw.rows)) return { total: 0, rows: [] };
  const rows = raw.rows.map(toUserRow).filter((r): r is UserRow => r !== null);
  return { total: Math.max(count(raw.total), rows.length), rows };
}

function toShares(raw: unknown, dim: DeviceDimension): DeviceShare[] {
  if (!Array.isArray(raw)) return [];
  const out: DeviceShare[] = [];
  for (const item of raw) {
    if (!isObj(item) || typeof item.key !== 'string') continue;
    if (typeof item.users !== 'number' && typeof item.users !== 'string') continue;
    if (item.key !== 'inconnu' && !Object.prototype.hasOwnProperty.call(LABELS[dim], item.key)) continue;
    out.push({ key: item.key, users: count(item.users) });
  }
  return out;
}

export function normalizeDevices(raw: unknown): DevicesPayload {
  if (!isObj(raw)) return { users: 0, platforms: [], browsers: [], forms: [], installed: [] };
  return {
    users: count(raw.users),
    platforms: toShares(raw.platforms, 'platform'),
    browsers: toShares(raw.browsers, 'browser'),
    forms: toShares(raw.forms, 'form'),
    installed: toShares(raw.installed, 'installed'),
  };
}

export interface DeviceLike {
  platform: string | null;
  browser: string | null;
  form: string | null;
  installed: boolean | null;
}

/** « iOS · Safari », « Android · Chrome · installée », ou « Appareil inconnu » si aucune information n'a été reçue. */
export function deviceLabel(d: DeviceLike): string {
  const parts: string[] = [];
  if (d.platform) parts.push(PLATFORM_LABEL[d.platform] ?? d.platform);
  if (d.browser) parts.push(BROWSER_LABEL[d.browser] ?? d.browser);
  if (parts.length === 0 && d.form) parts.push(FORM_LABEL[d.form] ?? d.form);
  if (parts.length === 0) return 'Appareil inconnu';
  if (d.installed === true) parts.push('installée');
  return parts.join(' · ');
}

export interface BarShare {
  key: string;
  label: string;
  users: number;
  pct: number;
}

/** Barres triées par nombre d'utilisateurs décroissant ; pct = part du total affiché (0 si total nul). */
export function barShares(items: readonly DeviceShare[], dim: DeviceDimension): BarShare[] {
  const total = items.reduce((s, i) => s + i.users, 0);
  return [...items]
    .sort((a, b) => b.users - a.users || a.key.localeCompare(b.key))
    .map(i => ({ key: i.key, label: i.key === 'inconnu' ? 'Inconnu' : (LABELS[dim][i.key] ?? i.key), users: i.users, pct: total > 0 ? Math.round((i.users / total) * 100) : 0 }));
}

export const pageCount = (total: number): number => Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
