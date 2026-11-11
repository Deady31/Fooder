/** Accès localStorage tolérant aux erreurs + événement de synchronisation entre composants. */
export const STORE_EVENT = 'fooder:store';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: key }));
    return true;
  } catch {
    return false;
  }
}

export function randomId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36).padStart(2, '0')).join('')
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}${rand}`;
}
