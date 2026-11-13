import { PERMANENT_FAILURES, PublishFailure, PublishOutcome, classifyPublishError, estimateDataUrlBytes } from './photoUpload';
import type { ErrorLike } from './photoUpload';

/**
 * File locale des posts à publier en ligne. Une photo non envoyée n'est jamais perdue en silence :
 * elle reste dans la file (bornée) et repart quand le réseau et la session reviennent.
 * Clé d'idempotence = id du post (uuid) : un post n'est jamais en double dans la file, ni envoyé deux fois en parallèle ;
 * côté serveur, l'envoi est lui aussi idempotent (fichier déjà présent / post déjà créé = succès, cf. publishCloudPost).
 * La file ne stocke que l'id : la photo reste dans le post local (pas de copie qui doublerait le stockage).
 */

export const QUEUE_KEY = 'fooder_upload_queue';
export const QUEUE_MAX_ITEMS = 5;
export const QUEUE_MAX_BYTES = 6_000_000;

export interface QueueItem {
  postId: string;
  bytes: number;
  queuedAt: number;
  attempts: number;
  reason?: PublishFailure;
}

export type UploadState = 'sending' | 'sent' | 'pending' | 'failed';

export interface UploadStatus {
  state: UploadState;
  reason?: PublishFailure;
  message?: string;
}

// ═════════════════════════ Opérations pures (immuables) ═════════════════════════

export function enqueue(queue: readonly QueueItem[], item: QueueItem): { queue: QueueItem[]; accepted: boolean } {
  if (queue.some(q => q.postId === item.postId)) return { queue: [...queue], accepted: true };
  const total = queue.reduce((s, q) => s + q.bytes, 0);
  if (queue.length >= QUEUE_MAX_ITEMS || total + item.bytes > QUEUE_MAX_BYTES) return { queue: [...queue], accepted: false };
  return { queue: [...queue, item], accepted: true };
}

export function markFailed(queue: readonly QueueItem[], postId: string, reason: PublishFailure): QueueItem[] {
  return queue.map(q => (q.postId === postId ? { ...q, attempts: q.attempts + 1, reason } : q));
}

export function removeItem(queue: readonly QueueItem[], postId: string): QueueItem[] {
  return queue.filter(q => q.postId !== postId);
}

function parseQueue(raw: string | null): QueueItem[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((x): x is QueueItem => typeof x === 'object' && x !== null && typeof (x as QueueItem).postId === 'string')
      .map(x => ({ postId: x.postId, bytes: Number(x.bytes) || 0, queuedAt: Number(x.queuedAt) || 0, attempts: Number(x.attempts) || 0, reason: x.reason }))
      .slice(0, QUEUE_MAX_ITEMS);
  } catch {
    return [];
  }
}

// ═════════════════════════ File avec envoi et reprise ═════════════════════════

export interface QueuePost {
  id: string;
  photo?: string;
}

export interface QueueDeps<P extends QueuePost> {
  store: { get: (key: string) => string | null; set: (key: string, value: string) => boolean };
  findPost: (postId: string) => P | null;
  send: (post: P) => Promise<PublishOutcome>;
  isOnline: () => boolean;
  now?: () => number;
}

export type StatusListener = (postId: string, status: UploadStatus) => void;

export interface UploadQueue {
  /** Ajoute le post à la file (si besoin) et tente l'envoi tout de suite. */
  submit: (postId: string) => Promise<UploadStatus>;
  /** Retente tout ce qui est en attente (reprise automatique ou bouton « Réessayer »). */
  flush: () => Promise<void>;
  pending: () => QueueItem[];
  status: (postId: string) => UploadStatus | undefined;
  subscribe: (listener: StatusListener) => () => void;
}

export function createUploadQueue<P extends QueuePost>(deps: QueueDeps<P>): UploadQueue {
  const statuses = new Map<string, UploadStatus>();
  const listeners = new Set<StatusListener>();
  const inflight = new Map<string, Promise<UploadStatus>>();
  let flushing: Promise<void> | null = null;
  const now = deps.now ?? (() => Date.now());

  const read = (): QueueItem[] => parseQueue(deps.store.get(QUEUE_KEY));
  const write = (q: QueueItem[]): boolean => deps.store.set(QUEUE_KEY, JSON.stringify(q));

  const emit = (postId: string, status: UploadStatus): UploadStatus => {
    statuses.set(postId, status);
    listeners.forEach(l => {
      try {
        l(postId, status);
      } catch {
        /* un abonné défaillant n'empêche pas les autres */
      }
    });
    return status;
  };

  const failure = (postId: string, reason: PublishFailure, message?: string): UploadStatus => {
    if (PERMANENT_FAILURES.includes(reason)) {
      write(removeItem(read(), postId));
      return emit(postId, { state: 'failed', reason, message });
    }
    write(markFailed(read(), postId, reason));
    return emit(postId, { state: 'pending', reason, message });
  };

  const attempt = (postId: string): Promise<UploadStatus> => {
    const running = inflight.get(postId);
    if (running) return running;
    const job = (async (): Promise<UploadStatus> => {
      const post = deps.findPost(postId);
      if (!post) {
        // Post supprimé de ce téléphone : plus rien à publier.
        write(removeItem(read(), postId));
        statuses.delete(postId);
        return { state: 'failed', reason: 'server' };
      }
      if (!deps.isOnline()) return failure(postId, 'offline');
      emit(postId, { state: 'sending' });
      let outcome: PublishOutcome;
      try {
        outcome = await deps.send(post);
      } catch (e) {
        outcome = { ok: false, reason: classifyPublishError(e as ErrorLike, { online: deps.isOnline() }) };
      }
      if (outcome.ok) {
        write(removeItem(read(), postId));
        return emit(postId, { state: 'sent' });
      }
      return failure(postId, outcome.reason ?? 'server', outcome.message);
    })().finally(() => inflight.delete(postId));
    inflight.set(postId, job);
    return job;
  };

  const submit = async (postId: string): Promise<UploadStatus> => {
    const post = deps.findPost(postId);
    if (!post) return { state: 'failed', reason: 'server' };
    const item: QueueItem = { postId, bytes: post.photo ? estimateDataUrlBytes(post.photo) : 0, queuedAt: now(), attempts: 0 };
    const { queue, accepted } = enqueue(read(), item);
    if (!accepted || !write(queue)) return emit(postId, { state: 'failed', reason: 'queue_full' });
    return attempt(postId);
  };

  const flush = (): Promise<void> => {
    if (flushing) return flushing;
    flushing = (async () => {
      for (const item of read()) await attempt(item.postId);
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  };

  return {
    submit,
    flush,
    pending: read,
    status: postId => statuses.get(postId),
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
