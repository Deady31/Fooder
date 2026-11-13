import { cloud, currentUserId, isCloudEnabled } from './cloud/client';
import { KeyValueStore, classifySendError, readOptIn, writeOptIn } from './usage';
import { Tracker, TrackOptions, TrackProps, createTracker } from './tracking';
import { detectDevice, deviceProps, readDeviceEnv } from './device';

// Mesure d'audience respectueuse : rien n'est envoyé sans consentement explicite (RGPD / CNIL).
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const CONSENT_KEY = 'fooder_consent';
const ID_KEY = 'fooder_anon_id';
const CONSENT_AT_KEY = 'fooder_consent_at';
const SIX_MONTHS_MS = 182 * 24 * 3600 * 1000; // la CNIL recommande de redemander le choix tous les 6 mois

export type Consent = 'granted' | 'denied';

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    const at = Number(localStorage.getItem(CONSENT_AT_KEY) ?? 0);
    if (at && Date.now() - at > SIX_MONTHS_MS) return null;
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
    localStorage.setItem(CONSENT_AT_KEY, String(Date.now()));
    if (value === 'denied') localStorage.removeItem(ID_KEY);
  } catch {
    /* stockage indisponible */
  }
}

function anonId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

export function analyticsEnabled(): boolean {
  return Boolean(KEY);
}

// ───────── Mesures d'usage (table Supabase `app_events`, voir lib/tracking.ts) ─────────
// Identifiant utilisateur stable (session Supabase, anonyme par défaut) pour mesurer rétention et parcours.
// Désactivables dans Compte (réglage « Aider à améliorer Fooder », activé par défaut).

function safeStorage(kind: 'local' | 'session' = 'local'): KeyValueStore | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

function deviceContext(): TrackProps {
  let ref = '';
  try {
    ref = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    ref = '';
  }
  return {
    device: window.matchMedia?.('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    ...deviceProps(detectDevice(readDeviceEnv())),
    ...(ref && ref !== window.location.hostname ? { ref } : {}),
  };
}

let tracker: Tracker | null = null;

/** Tracker navigateur (null côté serveur ou si le cloud n'est pas configuré). */
export function getTracker(): Tracker | null {
  if (typeof window === 'undefined' || !isCloudEnabled()) return null;
  if (tracker) return tracker;
  tracker = createTracker({
    cloudEnabled: isCloudEnabled,
    optedIn: () => readOptIn(safeStorage()),
    hasSession: async () => (await currentUserId()) !== null,
    send: async rows => {
      const sb = cloud();
      if (!sb) return 'retry';
      const { error, status } = await sb.from('app_events').insert(rows);
      return error ? classifySendError({ status }) : 'ok';
    },
    storage: safeStorage('local'),
    sessionStorage: safeStorage('session'),
    now: () => Date.now(),
    newId: newSessionId,
    context: deviceContext,
  });
  // Arrière-plan : on envoie la file (elle reste aussi en localStorage pour la prochaine ouverture)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void tracker?.flush();
  });
  // Retour en ligne : on relance les envois même après une série d'échecs
  window.addEventListener('online', () => {
    tracker?.resetFailures();
    void tracker?.flush();
  });
  return tracker;
}

export function getUsageEnabled(): boolean {
  return readOptIn(safeStorage());
}

export function setUsageEnabled(on: boolean): void {
  writeOptIn(safeStorage(), on);
  if (!on) getTracker()?.clear();
}

/** Envoie la file maintenant (appelé quand une session apparaît). No-op si cloud absent ou réglage désactivé. */
export function flushUsage(): void {
  if (typeof window === 'undefined' || !isCloudEnabled() || !getUsageEnabled()) return;
  const t = getTracker();
  t?.resetFailures();
  void t?.flush();
}

/**
 * Mesure un événement. Nom : minuscules, chiffres et _ (2 à 40 caractères). `rest_id` et `screen` peuvent être passés
 * dans les propriétés ou dans `opts` : ils deviennent des colonnes. Envoyé vers `app_events` (si réglage actif)
 * et vers PostHog (si consentement donné).
 */
export function track(event: string, properties: Record<string, string | number | boolean> = {}, opts?: TrackOptions): void {
  if (typeof window === 'undefined') return;
  getTracker()?.track(event, properties, opts);
  if (!KEY || getConsent() !== 'granted') return;
  void fetch(`${HOST}/capture/`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: KEY,
      event,
      distinct_id: anonId(),
      properties: { ...properties, $process_person_profile: false },
    }),
  }).catch(() => undefined);
}
