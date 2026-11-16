/**
 * Drapeau du mode démo (visite sans compte, ouverte depuis /demo). Fichier sans dépendance :
 * il est lu par le client cloud, qui doit rester coupé pendant toute la démo.
 */
export const DEMO_KEY = 'fooder_demo';

export function isDemo(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}
