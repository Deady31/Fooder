/**
 * Accès au backoffice : mot de passe unique (ADMIN_PASSCODE) puis cookie httpOnly signé HMAC (ADMIN_SESSION_SECRET), 12 h.
 * Côté serveur uniquement (node:crypto). Aucune valeur secrète n'est jamais renvoyée ni journalisée.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'fooder_admin';
export const SESSION_TTL_MS = 12 * 3600 * 1000;
export const MIN_SECRET_LENGTH = 32;
const TOKEN_VERSION = 'v1';

const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();

/** Comparaison à temps constant (les deux valeurs sont hachées : même longueur, aucune fuite de taille). */
export function checkPasscode(input: unknown, expected: string | undefined): boolean {
  if (typeof input !== 'string' || !input || !expected) return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

const sign = (payload: string, secret: string): string => createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');

/** Jeton « v1.<expiration ms>.<nonce>.<signature> ». */
export function signSession(secret: string, now: number, ttlMs = SESSION_TTL_MS): string {
  const payload = `${TOKEN_VERSION}.${now + ttlMs}.${randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token: string | undefined | null, secret: string | undefined, now: number): boolean {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION || !/^\d{10,16}$/.test(parts[1])) return false;
  const expected = Buffer.from(sign(parts.slice(0, 3).join('.'), secret));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(parts[1]) > now;
}

export interface AdminConfig {
  ok: boolean;
  /** Noms des variables absentes ou invalides (jamais leurs valeurs). */
  missing: string[];
  supabaseUrl: string;
}

type Env = Record<string, string | undefined>;

export function readAdminConfig(env: Env = process.env): AdminConfig {
  const missing: string[] = [];
  if (!env.ADMIN_PASSCODE || env.ADMIN_PASSCODE.length < 8) missing.push('ADMIN_PASSCODE');
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < MIN_SECRET_LENGTH) missing.push('ADMIN_SESSION_SECRET');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.length < 20) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  return { ok: missing.length === 0, missing, supabaseUrl };
}

/** Limiteur simple en mémoire (par instance serveur) : max essais par fenêtre glissante. */
export function createLoginLimiter(max = 8, windowMs = 15 * 60_000) {
  const hits = new Map<string, number[]>();
  return {
    /** true = essai autorisé (et compté). */
    hit(key: string, now: number): boolean {
      const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      hits.set(key, [...recent, now]);
      if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
      return true;
    },
    reset(key: string): void {
      hits.delete(key);
    },
  };
}

/** Session admin valide d'après la valeur du cookie (lecture des variables d'environnement serveur). */
export function isAdminToken(token: string | undefined, now = Date.now()): boolean {
  return verifySession(token, process.env.ADMIN_SESSION_SECRET, now);
}
