/**
 * Appels aux fonctions SQL admin_* avec la clé service_role. SERVEUR UNIQUEMENT :
 * la clé est lue dans process.env (jamais NEXT_PUBLIC_), jamais renvoyée ni journalisée.
 */
import { readAdminConfig } from './auth';

export type RpcErrorKind = 'missing_migration' | 'config' | 'upstream';

export class RpcError extends Error {
  constructor(public kind: RpcErrorKind, message: string) {
    super(message);
  }
}

/** Type de clé, déduit de son préfixe ou du rôle de son JWT (jamais la valeur). Sert uniquement au diagnostic. */
export function describeKey(key: string): string {
  const k = key.trim();
  if (!k) return 'vide';
  if (k !== key) return 'espace ou retour à la ligne parasite';
  if (/^["'].*["']$/.test(k)) return 'entre guillemets (à retirer)';
  if (k.startsWith('sb_secret_')) return 'clé secrète (sb_secret_…)';
  if (k.startsWith('sb_publishable_')) return 'clé PUBLIQUE (sb_publishable_…) : mauvaise clé, il faut la clé secrète';
  if (k.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(k.split('.')[1] ?? '', 'base64url').toString('utf8')) as { role?: string };
      return payload.role === 'service_role' ? 'JWT service_role' : `JWT de rôle « ${payload.role ?? 'inconnu'} » : mauvaise clé, il faut service_role`;
    } catch {
      return 'JWT illisible';
    }
  }
  return 'format inconnu';
}

function headers(key: string): Record<string, string> {
  // Anciennes clés (JWT « eyJ… ») : apikey + Authorization. Nouvelles clés secrètes (sb_secret_…) : apikey seulement.
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const cfg = readAdminConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg.ok || !key) throw new RpcError('config', 'Configuration incomplète.');
  let res: Response;
  try {
    res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(args),
      cache: 'no-store',
    });
  } catch {
    throw new RpcError('upstream', 'Supabase injoignable.');
  }
  if (res.ok) return (await res.json()) as T;
  let code = '';
  let upstreamMsg = '';
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    code = String(body.code ?? '');
    upstreamMsg = String(body.message ?? '').split(key).join('[clé]').slice(0, 120);
  } catch {
    code = '';
  }
  // PGRST202 : fonction introuvable ; 42P01 : table absente → la migration n'a pas été jouée.
  if (res.status === 404 || code === 'PGRST202' || code === '42P01' || code === '42883') {
    throw new RpcError('missing_migration', `Fonction ${fn} absente.`);
  }
  if (res.status === 401 || res.status === 403) {
    // Diagnostic sans fuite : on indique le TYPE de clé reçu (jamais sa valeur) et la réponse de Supabase.
    const detail = [`HTTP ${res.status}${code ? ` ${code}` : ''}`, `clé détectée : ${describeKey(key)}`, upstreamMsg].filter(Boolean).join(' ; ');
    throw new RpcError('config', `Clé service refusée par Supabase (${detail}).`);
  }
  throw new RpcError('upstream', `Erreur Supabase (${res.status}${code ? ` ${code}` : ''}).`);
}
