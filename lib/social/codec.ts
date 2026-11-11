/**
 * Encodage des liens de partage (carte d'ami, invitation de groupe, vote, défi).
 * Les données voyagent dans le fragment d'URL (#...) : elles ne sont jamais envoyées au serveur.
 * Format : <préfixe>.<base64url>, préfixe « z » = JSON compressé (deflate-raw), « j » = JSON brut.
 */

/** Longueur maximale acceptée pour un lien reçu : au-delà, on refuse sans décoder. */
export const MAX_ENCODED_LENGTH = 12_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Taille maximale après décompression : au-delà, on abandonne la lecture. */
export const MAX_DECODED_BYTES = 64_000;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      await reader.cancel();
      throw new Error('Contenu trop volumineux');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const canCompress = (): boolean => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodePayload(data: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  if (canCompress()) {
    try {
      return `z.${toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* compression indisponible : JSON brut */
    }
  }
  return `j.${toBase64Url(raw)}`;
}

/** Décode un lien reçu. Retourne null si le format est invalide : l'appelant doit ensuite valider le contenu. */
export async function decodePayload(encoded: string): Promise<unknown | null> {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return null;
  const dot = encoded.indexOf('.');
  if (dot !== 1) return null;
  const kind = encoded[0];
  const body = encoded.slice(2);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return null;
  try {
    let bytes = fromBase64Url(body);
    if (kind === 'z') {
      if (!canCompress()) return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_DECODED_BYTES);
    } else if (kind !== 'j') {
      return null;
    }
    if (bytes.length > MAX_DECODED_BYTES) return null;
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Lit « clé=valeur » dans le fragment d'URL courant. */
export function readHashParam(key: string, hash: string = typeof window !== 'undefined' ? window.location.hash : ''): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(key);
}

// ── Validation des données reçues (jamais de confiance aveugle) ──────────────

export function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.length > 0 ? clean.slice(0, max) : null;
}

export function num(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}

/** Horodatage reçu : jamais dans le futur (sinon il bloquerait toute mise à jour légitime). */
export function ts(v: unknown, now: number = Date.now()): number {
  return Math.round(num(v, 0, now + 5 * 60_000) ?? 0);
}

export function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

export function obj(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
