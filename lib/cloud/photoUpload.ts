/**
 * Règles pures d'envoi d'une photo de plat vers Supabase (bucket `photos` + table `posts`).
 * Elles recopient les contraintes du serveur (voir tests/photoUpload.test.ts) pour refuser AVANT l'envoi ce que le serveur
 * refuserait, et pour expliquer à l'utilisateur la vraie cause d'un échec.
 *
 * Pas de fetch() ici : la CSP `connect-src` de next.config.js n'autorise pas `data:`, donc `fetch('data:image/jpeg;...')`
 * échouait dans le navigateur (cause racine du « pas encore en ligne »). On décode le base64 à la main.
 */

/** Limite du bucket : 1 572 864 octets (1,5 Mio). On garde une petite marge. */
export const PHOTO_MAX_BYTES = 1_500_000;
/** Types MIME acceptés par le bucket (allowed_mime_types). */
export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/webp'] as const;
const EXT_BY_MIME: Record<string, 'jpg' | 'webp'> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };
/** Partie « nom de fichier » de la regex serveur : `<uid>/[A-Za-z0-9_-]{1,64}\.(jpg|webp)`. */
const FILE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=\s]+)$/i;

export type PublishFailure = 'offline' | 'no_session' | 'too_big' | 'bad_format' | 'quota' | 'server' | 'queue_full' | 'cloud_off';

/** Résultat à plat (projet non strict : une union ne se réduirait pas sur `ok`). */
export interface PublishOutcome {
  ok: boolean;
  reason?: PublishFailure;
  /** Message précis déjà en français (ex. raison de l'échec de session), prioritaire sur PUBLISH_MESSAGES. */
  message?: string;
}

/** Causes qui ne se résolvent pas en réessayant : pas de reprise automatique. */
export const PERMANENT_FAILURES: readonly PublishFailure[] = ['too_big', 'bad_format', 'queue_full', 'cloud_off'];

export const PUBLISH_MESSAGES: Record<PublishFailure, string> = {
  offline: 'Pas de connexion : ta photo est gardée et partira toute seule dès que le réseau revient.',
  no_session: 'Ton profil en ligne n’a pas pu être créé. Ta photo est gardée, on réessaie automatiquement.',
  too_big: 'Photo trop lourde pour être publiée (1,5 Mo maximum). Choisis une autre photo.',
  bad_format: 'Format de photo non accepté (JPEG ou WebP uniquement). Choisis une autre photo.',
  quota: 'Limite de publications du jour atteinte. Ta photo est gardée et repartira plus tard.',
  server: 'Le serveur n’a pas accepté la photo pour l’instant. Elle est gardée, on réessaie automatiquement.',
  queue_full: 'Trop de photos en attente d’envoi (5 maximum). Celle-ci reste sur ce téléphone : réessaie quand les autres seront parties.',
  cloud_off: 'La publication en ligne n’est pas activée sur cette version. Ta photo reste sur ce téléphone.',
};

export const publishMessage = (o: PublishOutcome): string | null =>
  o.ok || !o.reason ? null : o.message ?? PUBLISH_MESSAGES[o.reason];

export interface DecodedPhoto {
  mime: string;
  bytes: Uint8Array;
}

/** Décode `data:image/...;base64,...` en octets. null si ce n'est pas une image base64 valide. */
export function decodeDataUrl(dataUrl: string): DecodedPhoto | null {
  const m = (dataUrl ?? '').match(DATA_URL_RE);
  if (!m) return null;
  const rawMime = m[1].toLowerCase();
  const mime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    if (bin.length === 0) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  } catch {
    return null;
  }
}

/** Poids (octets) d'un data URL base64, sans le décoder. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1).replace(/\s+/g, '');
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

/** Chemin de stockage conforme à la regex serveur, ou null si impossible (MIME refusé, id ou uid invalide). */
export function photoPathFor(uid: string, postId: string, mime: string): string | null {
  const ext = EXT_BY_MIME[mime];
  if (!ext || !UID_RE.test(uid ?? '') || !FILE_ID.test(postId ?? '')) return null;
  return `${uid}/${postId}.${ext}`;
}

export interface PreparedPhoto {
  ok: boolean;
  reason?: PublishFailure;
  path?: string;
  mime?: string;
  bytes?: Uint8Array;
}

/** Vérifie format, poids et chemin AVANT l'envoi. */
export function preparePhoto(uid: string, postId: string, dataUrl: string): PreparedPhoto {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { ok: false, reason: 'bad_format' };
  if (!(PHOTO_ALLOWED_MIME as readonly string[]).includes(decoded.mime)) return { ok: false, reason: 'bad_format' };
  if (decoded.bytes.byteLength > PHOTO_MAX_BYTES) return { ok: false, reason: 'too_big' };
  const path = photoPathFor(uid, postId, decoded.mime);
  if (!path) return { ok: false, reason: 'bad_format' };
  return { ok: true, path, mime: decoded.mime, bytes: decoded.bytes };
}

export interface ErrorLike {
  message?: string;
  code?: string;
  status?: number | string;
  statusCode?: number | string;
  name?: string;
  error?: string;
}

/**
 * Classe une erreur Supabase (Storage, PostgREST) ou réseau.
 * `stage` : un refus RLS au dépôt de la photo vient du plafond quotidien (le chemin est déjà validé côté client) ;
 * à l'insertion du post, il signale une session qui ne correspond plus.
 */
export function classifyPublishError(
  err: ErrorLike | null | undefined,
  ctx: { online?: boolean; stage?: 'upload' | 'insert' } = {}
): PublishFailure {
  if (ctx.online === false) return 'offline';
  if (!err) return 'server';
  const msg = `${err.message ?? ''} ${err.error ?? ''}`.toLowerCase();
  const status = Number(err.statusCode ?? err.status ?? 0);
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|timed? ?out/.test(msg)) return 'offline';
  if (status === 401 || /jwt|token (is )?expired|not authenticated|invalid claim|missing sub/.test(msg)) return 'no_session';
  if (status === 413 || /exceeded the maximum|too large|payload too large|entity too large/.test(msg)) return 'too_big';
  if (status === 415 || /mime type|invalid_mime|not supported/.test(msg)) return 'bad_format';
  if (/daily .*limit|quota|too many/.test(msg) || status === 429) return 'quota';
  if (/row-level security|row level security/.test(msg) || status === 403) return ctx.stage === 'insert' ? 'no_session' : 'quota';
  return 'server';
}

/** Le fichier existe déjà (reprise après un envoi réussi dont l'insertion du post avait échoué). */
export function isDuplicateError(err: ErrorLike | null | undefined): boolean {
  if (!err) return false;
  const status = Number(err.statusCode ?? err.status ?? 0);
  return status === 409 || err.code === '23505' || /already exists|duplicate/i.test(`${err.message ?? ''} ${err.error ?? ''}`);
}
