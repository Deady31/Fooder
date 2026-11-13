import { FeedPost, POSTS_KEY } from '../feed';
import { EnsureResult, ensureCloudSession } from './session';
import { publishCloudPost } from './social';
import { ErrorLike, PublishOutcome, classifyPublishError } from './photoUpload';
import { UploadQueue, createUploadQueue } from './uploadQueue';

/**
 * Publie en ligne un post que l'utilisateur vient de valider (action explicite). Le post est déjà enregistré localement :
 * un échec ne perd rien et renvoie sa cause précise (hors-ligne, session, poids, format, quota, serveur).
 */
export interface PublishDeps {
  ensure: () => Promise<EnsureResult>;
  publish: (post: FeedPost, uid: string) => Promise<PublishOutcome>;
  isOnline: () => boolean;
}

const browserOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

const DEFAULT_DEPS: PublishDeps = { ensure: () => ensureCloudSession(), publish: (p, uid) => publishCloudPost(p, uid), isOnline: browserOnline };

export async function publishPostOnline(post: FeedPost, deps: PublishDeps = DEFAULT_DEPS): Promise<PublishOutcome> {
  if (!deps.isOnline()) return { ok: false, reason: 'offline' };
  let session: EnsureResult;
  try {
    session = await deps.ensure();
  } catch (e) {
    return { ok: false, reason: classifyPublishError(e as ErrorLike, { online: deps.isOnline() }) };
  }
  if (!session.ok || !session.uid) {
    if (session.reason === 'cloud_off') return { ok: false, reason: 'cloud_off' };
    if (session.reason === 'network') return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'no_session', message: session.message };
  }
  try {
    return await deps.publish(post, session.uid);
  } catch (e) {
    return { ok: false, reason: classifyPublishError(e as ErrorLike, { online: deps.isOnline() }) };
  }
}

// ═════════════════════════ File d'envoi du navigateur (une seule par onglet) ═════════════════════════

let queue: UploadQueue | null = null;
let retryStarted = false;

function readPosts(): FeedPost[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as FeedPost[]) : [];
  } catch {
    return [];
  }
}

export function getUploadQueue(): UploadQueue {
  if (!queue) {
    queue = createUploadQueue<FeedPost>({
      store: {
        get: key => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        set: (key, value) => {
          try {
            localStorage.setItem(key, value);
            return true;
          } catch {
            return false;
          }
        },
      },
      findPost: id => readPosts().find(p => p.id === id) ?? null,
      send: post => publishPostOnline(post),
      isOnline: browserOnline,
    });
  }
  return queue;
}

/**
 * Reprise automatique : au démarrage, au retour du réseau et quand l'appli revient au premier plan.
 * Idempotent (un seul jeu d'écouteurs par onglet).
 */
export function startUploadRetry(): void {
  if (retryStarted || typeof window === 'undefined') return;
  retryStarted = true;
  const flush = () => {
    if (getUploadQueue().pending().length > 0) void getUploadQueue().flush().catch(() => undefined);
  };
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
  flush();
}
