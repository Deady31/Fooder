/**
 * Suivi d'usage avec identifiant stable (table Supabase `app_events`, voir supabase/migrations/20261113000000_tracking.sql).
 * Module pur : réseau, stockage et horloge sont injectés (testable). Le câblage navigateur est dans lib/analytics.ts
 * et components/analytics/Tracker.tsx.
 *
 * - session : identifiant en sessionStorage, expirée après 30 min sans activité (session_start / session_end) ;
 * - temps actif : battement de cœur toutes les 15 s, seulement onglet visible et utilisateur actif depuis moins de 2 min ;
 * - file locale (localStorage) bornée, envoi par lots (taille ou délai), reprise après hors-ligne ;
 * - les contraintes appliquées ici sont les mêmes que celles de la table : une ligne invalide ferait refuser tout le lot.
 */
import type { KeyValueStore, SendResult } from './usage';

export const EVENT_NAME_RE = /^[a-z0-9_]{2,40}$/;
const PROP_KEY_RE = /^[a-z0-9_]{1,40}$/;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const REST_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const RESTO_PATH_RE = /^\/resto\/([^/?#]+)/;

export const SESSION_KEY = 'fooder_track_session';
export const QUEUE_KEY = 'fooder_track_queue';
export const SESSION_TIMEOUT_MS = 30 * 60_000;
export const HEARTBEAT_MS = 60_000; // 1 ligne par minute d'usage actif : 4x moins de volume que 15 s (disque Supabase gratuit limité)
export const IDLE_MS = 2 * 60_000;
export const MAX_QUEUE = 500;
export const BATCH_SIZE = 50;
export const FLUSH_DELAY_MS = 10_000;
export const FLUSH_THRESHOLD = 20;
export const MAX_FAILURES = 5;
export const MAX_PROP_KEYS = 20;
export const MAX_PROP_STRING = 120;
export const MAX_PROPS_BYTES = 1800; // la table refuse au-delà de 2 Ko
export const MAX_SCREEN = 120;
export const LABEL_MAX = 40;

export type PropValue = string | number | boolean;
export type TrackProps = Record<string, PropValue>;

/** Ligne telle qu'insérée dans `app_events` (user_id est posé par la base : auth.uid()). */
export interface TrackEvent {
  name: string;
  session_id: string;
  screen: string | null;
  rest_id: string | null;
  props: TrackProps;
  created_at: string;
}

export interface SessionState {
  id: string;
  startedAt: number;
  lastActivity: number;
  activeMs: number;
  ended?: boolean;
}

// ───────── Validation ─────────

export function isValidEventName(name: unknown): name is string {
  return typeof name === 'string' && EVENT_NAME_RE.test(name);
}

export function cleanRestId(v: unknown): string | null {
  return typeof v === 'string' && REST_ID_RE.test(v) ? v : null;
}

function cleanValue(v: unknown): PropValue | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(-1e9, Math.min(1e9, v)) : undefined;
  if (typeof v === 'string') return v.trim().slice(0, MAX_PROP_STRING);
  return undefined;
}

/** Garde au plus 20 clés snake_case aux valeurs simples, textes bornés, le tout sous 2 Ko. Ne modifie pas l'entrée. */
export function sanitizeTrackProps(props: unknown): TrackProps {
  if (typeof props !== 'object' || props === null || Array.isArray(props)) return {};
  const entries: Array<[string, PropValue]> = [];
  for (const [k, raw] of Object.entries(props as Record<string, unknown>)) {
    if (entries.length >= MAX_PROP_KEYS) break;
    if (!PROP_KEY_RE.test(k)) continue;
    const v = cleanValue(raw);
    if (v !== undefined) entries.push([k, v]);
  }
  while (entries.length > 0 && JSON.stringify(Object.fromEntries(entries)).length > MAX_PROPS_BYTES) entries.pop();
  return Object.fromEntries(entries);
}

// ───────── Écrans ─────────

const looksLikeId = (seg: string): boolean => (/\d/.test(seg) && seg.length >= 8) || /^[0-9a-f-]{32,36}$/i.test(seg);

/** « /resto/osm-n123?x=1 » → « /resto/[id] » : les identifiants sont regroupés pour compter les écrans. */
export function screenFromPath(path: unknown): string {
  if (typeof path !== 'string') return '/';
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  if (!clean) return '/';
  const segs = clean.split('/').filter(Boolean);
  const out = segs.map((s, i) => (segs[i - 1] === 'resto' || looksLikeId(s) ? '[id]' : s));
  return ('/' + out.join('/')).slice(0, MAX_SCREEN);
}

export function restIdFromPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const m = path.match(RESTO_PATH_RE);
  if (!m) return null;
  try {
    return cleanRestId(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}

/** Libellé de clic : espaces réduits, e-mails et longues suites de chiffres masqués, 40 caractères max. */
export function cleanLabel(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const s = text
    .replace(/\s+/g, ' ')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\d{4,}/g, '#')
    .trim()
    .slice(0, LABEL_MAX)
    .trim();
  return s || null;
}

// ───────── Sessions ─────────

export function parseSession(raw: string | null): SessionState | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<SessionState>;
    if (!d || typeof d.id !== 'string' || !SESSION_ID_RE.test(d.id)) return null;
    if (typeof d.startedAt !== 'number' || typeof d.lastActivity !== 'number') return null;
    return { id: d.id, startedAt: d.startedAt, lastActivity: d.lastActivity, activeMs: typeof d.activeMs === 'number' ? d.activeMs : 0, ended: d.ended === true };
  } catch {
    return null;
  }
}

export interface ResolvedSession {
  session: SessionState;
  started: boolean;
  /** Session précédente expirée (à clore par session_end), sinon null. */
  expired: SessionState | null;
}

/** Prolonge la session si la dernière activité date de moins de 30 min, sinon en ouvre une nouvelle. Pure. */
export function resolveSession(prev: SessionState | null, now: number, newId: () => string, timeout = SESSION_TIMEOUT_MS): ResolvedSession {
  if (prev && now - prev.lastActivity < timeout && now >= prev.startedAt) {
    return { session: { ...prev, lastActivity: now, ended: false }, started: false, expired: null };
  }
  return { session: { id: newId(), startedAt: now, lastActivity: now, activeMs: 0, ended: false }, started: true, expired: prev };
}

// ───────── Événements et file ─────────

export interface EventContext {
  sessionId: string;
  screen: string | null;
  now: number;
  restId?: string | null;
}

/** Construit la ligne ; `rest_id` et `screen` passés dans les propriétés deviennent des colonnes. */
export function buildEvent(name: unknown, props: unknown, ctx: EventContext): TrackEvent | null {
  if (!isValidEventName(name)) return null;
  const raw: Record<string, unknown> = typeof props === 'object' && props !== null && !Array.isArray(props) ? { ...(props as Record<string, unknown>) } : {};
  const restId = cleanRestId(raw.rest_id ?? raw.restId) ?? cleanRestId(ctx.restId);
  const screenProp = typeof raw.screen === 'string' && raw.screen.startsWith('/') ? screenFromPath(raw.screen) : null;
  delete raw.rest_id;
  delete raw.restId;
  delete raw.screen;
  return {
    name,
    session_id: ctx.sessionId,
    screen: screenProp ?? (ctx.screen ? ctx.screen.slice(0, MAX_SCREEN) : null),
    rest_id: restId,
    props: sanitizeTrackProps(raw),
    created_at: new Date(ctx.now).toISOString(),
  };
}

export function enqueue(queue: readonly TrackEvent[], ev: TrackEvent, max = MAX_QUEUE): TrackEvent[] {
  const next = [...queue, ev];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function takeBatch(queue: readonly TrackEvent[], size = BATCH_SIZE): TrackEvent[] {
  return queue.slice(0, size);
}

function reviveEvent(item: unknown): TrackEvent | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  if (!isValidEventName(o.name) || typeof o.session_id !== 'string' || !SESSION_ID_RE.test(o.session_id)) return null;
  if (typeof o.created_at !== 'string' || Number.isNaN(Date.parse(o.created_at))) return null;
  return {
    name: o.name,
    session_id: o.session_id,
    screen: typeof o.screen === 'string' ? o.screen.slice(0, MAX_SCREEN) : null,
    rest_id: cleanRestId(o.rest_id),
    props: sanitizeTrackProps(o.props),
    created_at: o.created_at,
  };
}

/** Relit la file stockée en revalidant chaque ligne (le stockage local n'est pas fiable). */
export function parseQueue(raw: string | null): TrackEvent[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(reviveEvent).filter((e): e is TrackEvent => e !== null).slice(-MAX_QUEUE);
  } catch {
    return [];
  }
}

// ───────── Tracker ─────────

export interface TrackingDeps {
  cloudEnabled: () => boolean;
  optedIn: () => boolean;
  /** Une session Supabase (anonyme ou non) existe-t-elle ? Sinon la file attend. */
  hasSession: () => Promise<boolean>;
  send: (rows: TrackEvent[]) => Promise<SendResult>;
  storage: KeyValueStore | null;
  sessionStorage: KeyValueStore | null;
  now: () => number;
  newId: () => string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Contexte ajouté à session_start (appareil, PWA installée…). */
  context?: () => TrackProps;
}

export interface TrackOptions {
  screen?: string;
  restId?: string;
}

export interface Tracker {
  track: (name: unknown, props?: unknown, opts?: TrackOptions) => boolean;
  screenView: (path: string) => boolean;
  /** À appeler toutes les 15 s ; n'enregistre que si l'onglet est visible et l'utilisateur actif récemment. */
  heartbeat: (visible: boolean) => boolean;
  noteActivity: () => void;
  endSession: (reason: string) => void;
  flush: () => Promise<void>;
  clear: () => void;
  resetFailures: () => void;
  size: () => number;
}

const read = (s: KeyValueStore | null, k: string): string | null => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};

const write = (s: KeyValueStore | null, k: string, v: string | null): void => {
  try {
    if (!s) return;
    if (v === null) s.removeItem(k);
    else s.setItem(k, v);
  } catch {
    /* stockage plein ou indisponible : on continue en mémoire */
  }
};

export function createTracker(deps: TrackingDeps): Tracker {
  let queue: TrackEvent[] | null = null;
  let session: SessionState | null | undefined;
  let screen: string | null = null;
  let lastInteraction = deps.now();
  let inflight: Promise<void> | null = null;
  let failures = 0;
  let timerSet = false;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  const active = (): boolean => deps.cloudEnabled() && deps.optedIn();
  const load = (): TrackEvent[] => (queue ??= parseQueue(read(deps.storage, QUEUE_KEY)));
  const persistQueue = (): void => write(deps.storage, QUEUE_KEY, queue && queue.length > 0 ? JSON.stringify(queue) : null);
  const loadSession = (): SessionState | null => (session === undefined ? (session = parseSession(read(deps.sessionStorage, SESSION_KEY))) : session);
  const saveSession = (s: SessionState): void => {
    session = s;
    write(deps.sessionStorage, SESSION_KEY, JSON.stringify(s));
  };

  const push = (ev: TrackEvent | null): void => {
    if (ev) queue = enqueue(load(), ev);
  };

  const endEvent = (s: SessionState, reason: string, at: number): TrackEvent | null =>
    buildEvent('session_end', { duration_s: Math.round((s.lastActivity - s.startedAt) / 1000), active_s: Math.round(s.activeMs / 1000), reason }, { sessionId: s.id, screen, now: at });

  /** Session courante (ouverte ou prolongée), avec session_end / session_start si besoin. */
  const touch = (now: number): SessionState => {
    const r = resolveSession(loadSession(), now, deps.newId);
    if (r.expired && !r.expired.ended) push(endEvent(r.expired, 'timeout', r.expired.lastActivity));
    if (r.started) push(buildEvent('session_start', deps.context?.() ?? {}, { sessionId: r.session.id, screen, now }));
    saveSession(r.session);
    return r.session;
  };

  const flush = (): Promise<void> => {
    if (inflight) return inflight;
    if (!active() || failures >= MAX_FAILURES || load().length === 0) return Promise.resolve();
    inflight = (async () => {
      if (!(await deps.hasSession())) return;
      const batch = takeBatch(load());
      let result: SendResult;
      try {
        result = await deps.send(batch);
      } catch {
        result = 'retry';
      }
      if (result === 'retry') {
        failures += 1;
        return;
      }
      failures = 0;
      // On retire exactement les lignes envoyées (d'autres ont pu arriver pendant l'envoi).
      queue = load().slice(batch.length);
      persistQueue();
    })().finally(() => {
      inflight = null;
    });
    return inflight.then(() => (load().length >= FLUSH_THRESHOLD && failures === 0 && active() ? flush() : undefined));
  };

  const schedule = (): void => {
    if (timerSet) return;
    timerSet = true;
    setTimer(() => {
      timerSet = false;
      void flush();
    }, FLUSH_DELAY_MS);
  };

  const afterPush = (): void => {
    persistQueue();
    if (load().length >= FLUSH_THRESHOLD) void flush();
    else schedule();
  };

  const track = (name: unknown, props?: unknown, opts?: TrackOptions): boolean => {
    if (!active() || !isValidEventName(name)) return false;
    const now = deps.now();
    const s = touch(now);
    const scr = opts?.screen ? screenFromPath(opts.screen) : screen;
    push(buildEvent(name, props, { sessionId: s.id, screen: scr, now, restId: opts?.restId ?? null }));
    afterPush();
    return true;
  };

  const screenView = (path: string): boolean => {
    if (!active()) return false;
    const next = screenFromPath(path);
    const from = screen;
    lastInteraction = deps.now();
    const s = touch(lastInteraction);
    screen = next;
    push(buildEvent('screen_view', from ? { from } : {}, { sessionId: s.id, screen: next, now: lastInteraction, restId: restIdFromPath(path) }));
    afterPush();
    return true;
  };

  const heartbeat = (visible: boolean): boolean => {
    const now = deps.now();
    if (!active() || !visible || now - lastInteraction > IDLE_MS) return false;
    const s = touch(now);
    saveSession({ ...s, activeMs: s.activeMs + HEARTBEAT_MS });
    push(buildEvent('heartbeat', { s: HEARTBEAT_MS / 1000 }, { sessionId: s.id, screen, now }));
    afterPush();
    return true;
  };

  const endSession = (reason: string): void => {
    const s = loadSession();
    if (!active() || !s || s.ended) return;
    push(endEvent(s, reason, s.lastActivity));
    saveSession({ ...s, ended: true });
    persistQueue();
  };

  const clear = (): void => {
    queue = [];
    persistQueue();
  };

  return {
    track,
    screenView,
    heartbeat,
    noteActivity: () => {
      lastInteraction = deps.now();
    },
    endSession,
    flush,
    clear,
    resetFailures: () => {
      failures = 0;
    },
    size: () => load().length,
  };
}
