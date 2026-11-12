/**
 * Mesures d'usage minimales et anonymes (table Supabase `events`).
 * Ce module est pur (aucun accès réseau ni DOM direct) : le réseau et le stockage sont injectés, ce qui le rend testable.
 * Le câblage réel est dans lib/analytics.ts.
 */

export const USAGE_EVENTS = [
  'swipe_like',
  'swipe_pass',
  'open_card',
  'checkin',
  'friend_added',
  'group_joined',
  'photo_posted',
  'signup',
  'share',
] as const;

export type UsageEventName = (typeof USAGE_EVENTS)[number];
export type UsagePropValue = string | number | boolean;
export type UsageProps = Record<string, UsagePropValue>;

export interface UsageRow {
  name: UsageEventName;
  props: UsageProps;
}

type PropKind = 'n' | 'b' | 's';

/**
 * Propriétés autorisées par événement (toute autre clé est ignorée) :
 * n = nombre (entier borné), b = booléen, s = mot-clé court (minuscules, chiffres, _ et -), jamais de texte libre.
 */
export const PROP_SCHEMA: Record<UsageEventName, Record<string, PropKind>> = {
  swipe_like: { cuisine: 's', position: 'n', distance_km: 'n' },
  swipe_pass: { cuisine: 's', position: 'n', distance_km: 'n' },
  open_card: { cuisine: 's', from: 's' },
  checkin: { verdict: 's', photo: 'b' },
  friend_added: { method: 's' },
  group_joined: { size: 'n', role: 's' },
  photo_posted: { verdict: 's' },
  signup: { method: 's' },
  share: { kind: 's' },
};

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const NUM_MAX = 100_000;
/** Une valeur qui ressemble à un e-mail, un identifiant ou un jeton n'est jamais acceptée. */
const LOOKS_PERSONAL_RE = /^[0-9a-f]{12,}$|^[0-9a-f-]{32,}$/;

export const MAX_QUEUE = 200;
export const BATCH_SIZE = 50;
export const FLUSH_DELAY_MS = 15_000;
export const FLUSH_THRESHOLD = 20;
export const MAX_FAILURES = 5;
export const QUEUE_KEY = 'fooder_usage_queue';
export const OPT_KEY = 'fooder_usage';

export function isUsageEvent(name: unknown): name is UsageEventName {
  return typeof name === 'string' && (USAGE_EVENTS as readonly string[]).includes(name);
}

function cleanValue(kind: PropKind, v: unknown): UsagePropValue | undefined {
  if (kind === 'b') return typeof v === 'boolean' ? v : undefined;
  if (kind === 'n') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    return Math.max(-NUM_MAX, Math.min(NUM_MAX, Math.round(v)));
  }
  if (typeof v !== 'string' || !SLUG_RE.test(v) || LOOKS_PERSONAL_RE.test(v)) return undefined;
  return v;
}

/** Ne garde que les propriétés prévues pour l'événement et de forme sûre. */
export function sanitizeProps(name: UsageEventName, props: unknown): UsageProps {
  const out: UsageProps = {};
  if (typeof props !== 'object' || props === null || Array.isArray(props)) return out;
  const schema = PROP_SCHEMA[name];
  for (const [key, kind] of Object.entries(schema)) {
    const v = cleanValue(kind, (props as Record<string, unknown>)[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** Construit la ligne à envoyer, ou null si l'événement n'est pas dans la liste blanche. */
export function buildRow(name: unknown, props?: unknown): UsageRow | null {
  if (!isUsageEvent(name)) return null;
  return { name, props: sanitizeProps(name, props) };
}

/** File d'attente bornée : au-delà de `max`, les plus anciens sont abandonnés. Ne modifie pas l'entrée. */
export function enqueue(queue: readonly UsageRow[], row: UsageRow, max = MAX_QUEUE): UsageRow[] {
  const next = [...queue, row];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function takeBatch(queue: readonly UsageRow[], size = BATCH_SIZE): UsageRow[] {
  return queue.slice(0, size);
}

/** Relit une file depuis le stockage en revalidant chaque ligne (le stockage local n'est pas fiable). */
export function parseQueue(raw: string | null): UsageRow[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const rows: UsageRow[] = [];
    for (const item of data) {
      const row = item && typeof item === 'object' ? buildRow((item as { name?: unknown }).name, (item as { props?: unknown }).props) : null;
      if (row) rows.push(row);
    }
    return rows.slice(-MAX_QUEUE);
  } catch {
    return [];
  }
}

/** Résultat d'un envoi : ok = reçu ; drop = refus définitif (ne pas réessayer) ; retry = problème passager. */
export type SendResult = 'ok' | 'drop' | 'retry';

/** Classe une erreur Supabase/PostgREST : les refus 4xx (hors 401/429) sont définitifs. */
export function classifySendError(err: { status?: number; code?: string } | null | undefined): SendResult {
  if (!err) return 'ok';
  const s = err.status ?? 0;
  if (s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429) return 'drop';
  return 'retry';
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TrackerDeps {
  /** Le cloud est-il configuré ? Sinon tout est un no-op. */
  cloudEnabled: () => boolean;
  /** L'utilisateur accepte-t-il les mesures anonymes ? */
  optedIn: () => boolean;
  /** Y a-t-il une session (anonyme ou non) pour envoyer ? Sinon la file attend. */
  hasSession: () => Promise<boolean>;
  send: (rows: UsageRow[]) => Promise<SendResult>;
  storage: KeyValueStore | null;
  setTimer?: (fn: () => void, ms: number) => unknown;
}

export interface UsageTracker {
  track: (name: unknown, props?: unknown) => boolean;
  flush: () => Promise<void>;
  clear: () => void;
  /** Remet le compteur d'échecs à zéro (retour en ligne). */
  resetFailures: () => void;
  size: () => number;
}

export function createUsageTracker(deps: TrackerDeps): UsageTracker {
  let queue: UsageRow[] | null = null;
  let flushing = false;
  let failures = 0;
  let timerSet = false;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  const load = (): UsageRow[] => {
    if (queue === null) {
      let raw: string | null = null;
      try {
        raw = deps.storage?.getItem(QUEUE_KEY) ?? null;
      } catch {
        raw = null;
      }
      queue = parseQueue(raw);
    }
    return queue;
  };

  const persist = (): void => {
    try {
      if (!deps.storage) return;
      if (!queue || queue.length === 0) deps.storage.removeItem(QUEUE_KEY);
      else deps.storage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* stockage plein ou indisponible : la file reste en mémoire */
    }
  };

  const active = (): boolean => deps.cloudEnabled() && deps.optedIn();

  const flush = async (): Promise<void> => {
    if (flushing || !active() || failures >= MAX_FAILURES) return;
    const current = load();
    if (current.length === 0) return;
    flushing = true;
    try {
      if (!(await deps.hasSession())) return;
      const batch = takeBatch(current);
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
      // On retire exactement les lignes envoyées (de nouvelles ont pu arriver pendant l'envoi).
      queue = (queue ?? []).slice(batch.length);
      persist();
      if (queue.length >= FLUSH_THRESHOLD) void flush();
    } finally {
      flushing = false;
    }
  };

  const schedule = (): void => {
    if (timerSet) return;
    timerSet = true;
    setTimer(() => {
      timerSet = false;
      void flush();
    }, FLUSH_DELAY_MS);
  };

  const track = (name: unknown, props?: unknown): boolean => {
    if (!active()) return false;
    const row = buildRow(name, props);
    if (!row) return false;
    failures = 0;
    queue = enqueue(load(), row);
    persist();
    if (queue.length >= FLUSH_THRESHOLD) void flush();
    else schedule();
    return true;
  };

  const clear = (): void => {
    queue = [];
    persist();
  };

  return { track, flush, clear, resetFailures: () => { failures = 0; }, size: () => load().length };
}

/** Réglage « mesures anonymes » : activé par défaut, seul un refus explicite le désactive. */
export function readOptIn(storage: KeyValueStore | null): boolean {
  try {
    return storage?.getItem(OPT_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeOptIn(storage: KeyValueStore | null, on: boolean): void {
  try {
    if (!storage) return;
    if (on) storage.removeItem(OPT_KEY);
    else storage.setItem(OPT_KEY, 'off');
  } catch {
    /* stockage indisponible */
  }
}
