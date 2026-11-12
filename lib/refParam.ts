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
