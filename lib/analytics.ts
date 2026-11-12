import { cloud, currentUserId, isCloudEnabled } from './cloud/client';
import { KeyValueStore, UsageTracker, classifySendError, createUsageTracker, readOptIn, writeOptIn } from './usage';

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

// ───────── Mesures d'usage anonymes (table Supabase `events`, voir lib/usage.ts) ─────────
// Indépendantes du consentement PostHog : liste blanche stricte, aucune donnée personnelle, désactivables dans Compte.

function safeStorage(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let usageTracker: UsageTracker | null = null;

function usage(): UsageTracker {
  if (usageTracker) return usageTracker;
  usageTracker = createUsageTracker({
    cloudEnabled: isCloudEnabled,
    optedIn: () => readOptIn(safeStorage()),
    hasSession: async () => (await currentUserId()) !== null,
    send: async rows => {
      const sb = cloud();
      if (!sb) return 'retry';
      const { error, status } = await sb.from('events').insert(rows);
      return error ? classifySendError({ status }) : 'ok';
    },
    storage: safeStorage(),
  });
  // Envoi à la mise en arrière-plan : la file ne reste pas bloquée sur un appareil qu'on ferme
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void usageTracker?.flush());
  // Retour en ligne : on relance les envois même après une série d'échecs
  window.addEventListener('online', () => {
    usageTracker?.resetFailures();
    void usageTracker?.flush();
  });
  return usageTracker;
}

export function getUsageEnabled(): boolean {
  return readOptIn(safeStorage());
}

export function setUsageEnabled(on: boolean): void {
  writeOptIn(safeStorage(), on);
  if (!on && typeof window !== 'undefined') usage().clear();
}

/** Envoie la file maintenant (appelé quand une session apparaît). No-op si cloud absent ou réglage désactivé. */
export function flushUsage(): void {
  if (typeof window === 'undefined' || !isCloudEnabled() || !getUsageEnabled()) return;
  void usage().flush();
}

export function track(event: string, properties: Record<string, string | number | boolean> = {}): void {
  if (typeof window === 'undefined') return;
  if (isCloudEnabled()) usage().track(event, properties);
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
