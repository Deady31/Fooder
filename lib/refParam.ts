export const REF_KEY = 'fooder_ref';

const REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Code de parrainage contenu dans une query string (« ?ref=CODE »), ou null. */
export function extractRef(search: string): string | null {
  if (typeof search !== 'string' || !search) return null;
  const value = new URLSearchParams(search).get('ref');
  return value && REF_PATTERN.test(value) ? value : null;
}

/** Mémorise le code dans sessionStorage, sans rien faire d'autre. */
export function rememberRef(search: string): void {
  const ref = extractRef(search);
  if (!ref) return;
  try {
    sessionStorage.setItem(REF_KEY, ref);
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export const REPLAY_PARAM = 'rejouer';

/** Vrai pour « ?rejouer=1 » : relance l'onboarding (outil de test), rien d'autre. */
export function wantsReplay(search: string): boolean {
  if (typeof search !== 'string' || !search) return false;
  return new URLSearchParams(search).get(REPLAY_PARAM) === '1';
}

/** Query string sans le paramètre « rejouer » (évite la boucle au rechargement) ; garde les autres paramètres. */
export function withoutReplayParam(search: string): string {
  if (typeof search !== 'string' || !search) return '';
  const params = new URLSearchParams(search);
  params.delete(REPLAY_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
