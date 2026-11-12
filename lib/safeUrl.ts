const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * URL de site web sûre pour un href : http(s) uniquement. Un domaine nu (www.x.fr) reçoit https://.
 * Tout autre schéma (javascript:, data:, etc.), valeur vide ou illisible donne undefined.
 */
export function safeWebUrl(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s || /\s/.test(s) || s.startsWith('//')) return undefined;
  let candidate = s;
  if (!SCHEME_RE.test(s)) {
    if (!/^[^/?#.]+(\.[^/?#.]+)+([/?#]|$)/.test(s)) return undefined;
    candidate = `https://${s}`;
  }
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Page de crédit photo : uniquement https://commons.wikimedia.org/. */
export function safeCommonsPage(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' && u.hostname === 'commons.wikimedia.org' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
