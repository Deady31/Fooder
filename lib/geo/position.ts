/**
 * Position de l'utilisateur : logique pure + traqueur indépendant de React (testable avec un faux
 * navigator.geolocation). Le deck n'attend JAMAIS cette position : il part de la dernière position
 * connue ou du Capitole, puis se réordonne quand une position précise arrive.
 */

export interface Coords {
  lat: number;
  lng: number;
}

export type PositionStatus = 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable' | 'timeout';
export type PositionSource = 'gps' | 'manual' | 'default' | 'last';
export type AccuracyLevel = 'good' | 'fair' | 'poor' | 'none';

export interface PositionState {
  coords: Coords;
  /** Précision en mètres (rayon), null si inconnue. */
  accuracy: number | null;
  status: PositionStatus;
  source: PositionSource;
  /** Horodatage de la dernière position GPS (ms), null sinon. */
  updatedAt: number | null;
  /** Adresse saisie à la main (source 'manual'). */
  label?: string | null;
}

/** Place du Capitole : repli quand aucune position n'est connue. */
export const TOULOUSE_CENTER: Coords = { lat: 43.6045, lng: 1.4442 };

export const LAST_POSITION_KEY = 'fooder_last_position';
export const MANUAL_POSITION_KEY = 'fooder_manual_position';
export const LAST_POSITION_TTL_MS = 24 * 3600_000;

/** Précision visée avant d'arrêter le suivi (m). */
export const TARGET_ACCURACY_M = 50;
/** Durée maximale du suivi d'affinage (ms). */
export const REFINE_MS = 20_000;
/** Délai de la première demande haute précision (ms, compté par le navigateur après l'accord). */
export const FIRST_FIX_TIMEOUT_MS = 8_000;
/** Une position de moins d'une minute est réutilisable telle quelle. */
export const MAX_AGE_MS = 60_000;

/* ── Arrondis et stockage ─────────────────────────────────────────── */

export function roundCoord(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function roundCoords(c: Coords, decimals = 3): Coords {
  return { lat: roundCoord(c.lat, decimals), lng: roundCoord(c.lng, decimals) };
}

export function isValidCoords(c: unknown): c is Coords {
  if (!c || typeof c !== 'object') return false;
  const { lat, lng } = c as Record<string, unknown>;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export interface StoredPosition {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export interface StoredManual {
  lat: number;
  lng: number;
  label: string;
}

/** Dernière position à mémoriser : arrondie à 3 décimales (~100 m) et horodatée. */
export function toStoredPosition(c: Coords, accuracy: number, at: number): StoredPosition {
  return { ...roundCoords(c, 3), accuracy: Math.round(accuracy), at };
}

/** Relit défensivement la dernière position ; null si invalide, future ou de plus de 24 h. */
export function parseStoredPosition(value: unknown, now: number, ttl = LAST_POSITION_TTL_MS): StoredPosition | null {
  if (!isValidCoords(value)) return null;
  const { accuracy, at } = value as unknown as Record<string, unknown>;
  if (typeof at !== 'number' || !Number.isFinite(at) || at > now || now - at > ttl) return null;
  const acc = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 1000;
  return { lat: value.lat, lng: value.lng, accuracy: acc, at };
}

export function parseStoredManual(value: unknown): StoredManual | null {
  if (!isValidCoords(value)) return null;
  const label = (value as unknown as Record<string, unknown>).label;
  if (typeof label !== 'string' || label.trim() === '' || label.length > 200) return null;
  return { lat: value.lat, lng: value.lng, label };
}

/** État de départ, disponible immédiatement (aucune attente réseau ni GPS). */
export function initialPosition(last: StoredPosition | null, manual: StoredManual | null): PositionState {
  if (manual) {
    return { coords: { lat: manual.lat, lng: manual.lng }, accuracy: null, status: 'idle', source: 'manual', updatedAt: null, label: manual.label };
  }
  if (last) {
    return { coords: { lat: last.lat, lng: last.lng }, accuracy: last.accuracy, status: 'idle', source: 'last', updatedAt: last.at };
  }
  return { coords: TOULOUSE_CENTER, accuracy: null, status: 'idle', source: 'default', updatedAt: null };
}

/* ── Présentation ─────────────────────────────────────────────────── */

export function statusFromError(code: number): PositionStatus {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export function formatAccuracy(m: number): string {
  return m < 1000 ? `±${Math.round(m)} m` : `±${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Fiabilité affichée : ≤ 50 m bonne, ≤ 200 m moyenne, au-delà faible ; dernière position : moyenne au mieux ; centre par défaut : aucune. */
export function accuracyLevel(accuracy: number | null, source: PositionSource): AccuracyLevel {
  if (source === 'manual') return 'good';
  if (source === 'default' || accuracy === null) return 'none';
  // Une position mémorisée n'est jamais « précise » : la personne a pu bouger depuis.
  if (accuracy <= TARGET_ACCURACY_M) return source === 'last' ? 'fair' : 'good';
  if (accuracy <= 200) return 'fair';
  return 'poor';
}

/* ── Traqueur ─────────────────────────────────────────────────────── */

/** Sous-ensemble de navigator.geolocation (injectable dans les tests). */
export interface GeolocationLike {
  getCurrentPosition(ok: PositionCallback, ko?: PositionErrorCallback | null, opts?: PositionOptions): void;
  watchPosition(ok: PositionCallback, ko?: PositionErrorCallback | null, opts?: PositionOptions): number;
  clearWatch(id: number): void;
}

export interface Fix {
  coords: Coords;
  accuracy: number;
  at: number;
}

export interface TrackerEvents {
  /** Nouvelle position meilleure que la précédente. */
  onFix: (fix: Fix) => void;
  onError: (status: PositionStatus) => void;
  /** Suivi terminé (précision atteinte, 20 s écoulées ou refus). */
  onDone?: () => void;
}

export interface TrackerOptions {
  targetAccuracy?: number;
  refineMs?: number;
  timeoutMs?: number;
  maximumAge?: number;
  now?: () => number;
}

export interface PositionTracker {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * 1) getCurrentPosition haute précision (8 s) ; 2) si la précision dépasse 50 m (ou délai dépassé),
 * watchPosition jusqu'à ≤ 50 m ou 20 s ; 3) arrêt propre (clearWatch + minuterie annulée).
 */
export function createPositionTracker(geo: GeolocationLike | null | undefined, events: TrackerEvents, opts: TrackerOptions = {}): PositionTracker {
  const target = opts.targetAccuracy ?? TARGET_ACCURACY_M;
  const refineMs = opts.refineMs ?? REFINE_MS;
  const now = opts.now ?? (() => Date.now());
  let running = false;
  let session = 0;
  let watchId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let best = Infinity;

  const cleanup = () => {
    if (watchId !== null && geo) geo.clearWatch(watchId);
    if (timer !== null) clearTimeout(timer);
    watchId = null;
    timer = null;
    running = false;
  };

  const finish = (id: number) => {
    if (id !== session || !running) return;
    cleanup();
    events.onDone?.();
  };

  /** Rapporte une position si elle est meilleure ; vrai si la précision visée est atteinte. */
  const accept = (id: number, p: GeolocationPosition): boolean => {
    if (id !== session || !running) return false;
    const accuracy = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : 1000;
    const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!isValidCoords(coords)) return false;
    if (accuracy < best) {
      best = accuracy;
      events.onFix({ coords, accuracy, at: now() });
    }
    return accuracy <= target;
  };

  const startWatch = (id: number) => {
    watchId = geo!.watchPosition(
      p => { if (accept(id, p)) finish(id); },
      e => {
        if (id !== session || !running) return;
        if (e.code === 1) {
          events.onError('denied');
          finish(id);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: refineMs },
    );
    timer = setTimeout(() => finish(id), refineMs);
  };

  return {
    start() {
      cleanup();
      const id = ++session;
      best = Infinity;
      if (!geo) {
        events.onError('unavailable');
        return;
      }
      running = true;
      geo.getCurrentPosition(
        p => {
          if (id !== session || !running) return;
          if (accept(id, p)) finish(id);
          else startWatch(id);
        },
        e => {
          if (id !== session || !running) return;
          const status = statusFromError(e.code);
          events.onError(status);
          if (status === 'timeout') startWatch(id);
          else finish(id);
        },
        { enableHighAccuracy: true, timeout: opts.timeoutMs ?? FIRST_FIX_TIMEOUT_MS, maximumAge: opts.maximumAge ?? MAX_AGE_MS },
      );
    },
    stop() {
      session++;
      cleanup();
    },
    isRunning: () => running,
  };
}
