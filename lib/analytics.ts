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

export function track(event: string, properties: Record<string, string | number | boolean> = {}): void {
  if (!KEY || typeof window === 'undefined' || getConsent() !== 'granted') return;
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
