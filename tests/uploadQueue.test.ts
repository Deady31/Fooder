import { describe, expect, it, vi } from 'vitest';
import {
  QUEUE_MAX_BYTES,
  QUEUE_MAX_ITEMS,
  QueueItem,
  createUploadQueue,
  enqueue,
  markFailed,
  removeItem,
} from '../lib/cloud/uploadQueue';
import type { PublishOutcome } from '../lib/cloud/photoUpload';

const item = (postId: string, bytes = 100_000): QueueItem => ({ postId, bytes, queuedAt: 1, attempts: 0 });

describe('file d\'attente : opérations pures', () => {
  it('ajoute, sans doublon (clé = id du post)', () => {
    const a = enqueue([], item('p1'));
    expect(a.accepted).toBe(true);
    const b = enqueue(a.queue, item('p1'));
    expect(b.accepted).toBe(true);
    expect(b.queue).toHaveLength(1);
    expect(a.queue).toHaveLength(1); // immuable
  });

  it('borne : 5 éléments maximum, jamais d\'éviction silencieuse', () => {
    let q: QueueItem[] = [];
    for (let i = 0; i < QUEUE_MAX_ITEMS; i++) q = enqueue(q, item(`p${i}`)).queue;
    const r = enqueue(q, item('extra'));
    expect(r.accepted).toBe(false);
    expect(r.queue).toHaveLength(QUEUE_MAX_ITEMS);
    expect(r.queue.map(x => x.postId)).not.toContain('extra');
  });

  it('borne : 6 Mo au total', () => {
    const q = enqueue([], item('big', QUEUE_MAX_BYTES - 10)).queue;
    expect(enqueue(q, item('p2', 100)).accepted).toBe(false);
    expect(enqueue(q, item('p3', 5)).accepted).toBe(true);
  });

  it('markFailed et removeItem renvoient de nouvelles listes', () => {
    const q = [item('p1'), item('p2')];
    const f = markFailed(q, 'p1', 'offline');
    expect(f[0]).toMatchObject({ attempts: 1, reason: 'offline' });
    expect(q[0].attempts).toBe(0);
    expect(removeItem(f, 'p1').map(x => x.postId)).toEqual(['p2']);
  });
});

function memoryStore() {
  const data = new Map<string, string>();
  return {
    get: (k: string) => data.get(k) ?? null,
    set: (k: string, v: string) => {
      data.set(k, v);
      return true;
    },
  };
}

describe('createUploadQueue : envoi, reprise, idempotence', () => {
  const posts = new Map([
    ['p1', { id: 'p1', photo: 'data:image/jpeg;base64,AAAA' }],
    ['p2', { id: 'p2', photo: 'data:image/jpeg;base64,BBBB' }],
  ]);

  it('succès : sort de la file, état « envoyée »', async () => {
    const send = vi.fn(async (): Promise<PublishOutcome> => ({ ok: true }));
    const q = createUploadQueue({ store: memoryStore(), findPost: id => posts.get(id) ?? null, send, isOnline: () => true });
    const r = await q.submit('p1');
    expect(r).toEqual({ state: 'sent' });
    expect(q.pending()).toHaveLength(0);
    expect(q.status('p1')).toEqual({ state: 'sent' });
  });

  it('échec réseau : reste en attente avec la raison, repart au flush suivant, une seule fois', async () => {
    let online = false;
    const send = vi.fn(async (): Promise<PublishOutcome> => (online ? { ok: true } : { ok: false, reason: 'offline' }));
    const store = memoryStore();
    const q = createUploadQueue({ store, findPost: id => posts.get(id) ?? null, send, isOnline: () => online });
    const r = await q.submit('p1');
    expect(r).toEqual({ state: 'pending', reason: 'offline' });
    expect(send).not.toHaveBeenCalled(); // hors-ligne : on n'essaie même pas
    expect(q.pending().map(x => x.postId)).toEqual(['p1']);

    // persistance : une nouvelle instance (rechargement de page) retrouve la file
    online = true;
    const q2 = createUploadQueue({ store, findPost: id => posts.get(id) ?? null, send, isOnline: () => online });
    await Promise.all([q2.flush(), q2.flush()]); // flush concurrents : pas de double envoi
    expect(send).toHaveBeenCalledTimes(1);
    expect(q2.pending()).toHaveLength(0);
  });

  it('cause permanente (trop lourd) : retirée de la reprise auto mais signalée, jamais perdue en silence', async () => {
    const send = vi.fn(async (): Promise<PublishOutcome> => ({ ok: false, reason: 'too_big' }));
    const q = createUploadQueue({ store: memoryStore(), findPost: id => posts.get(id) ?? null, send, isOnline: () => true });
    const r = await q.submit('p1');
    expect(r).toEqual({ state: 'failed', reason: 'too_big' });
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('post supprimé localement entre-temps : abandonné (rien à publier)', async () => {
    const send = vi.fn(async (): Promise<PublishOutcome> => ({ ok: false, reason: 'offline' }));
    const known = new Map(posts);
    const q = createUploadQueue({ store: memoryStore(), findPost: id => known.get(id) ?? null, send, isOnline: () => true });
    await q.submit('p1');
    known.delete('p1');
    await q.flush();
    expect(q.pending()).toHaveLength(0);
  });

  it('file pleine : refus explicite (état failed + raison queue_full)', async () => {
    const send = vi.fn(async (): Promise<PublishOutcome> => ({ ok: false, reason: 'offline' }));
    const many = new Map(Array.from({ length: 7 }, (_, i) => [`x${i}`, { id: `x${i}`, photo: 'data:image/jpeg;base64,AAAA' }]));
    const q = createUploadQueue({ store: memoryStore(), findPost: id => many.get(id) ?? null, send, isOnline: () => false });
    for (let i = 0; i < QUEUE_MAX_ITEMS; i++) await q.submit(`x${i}`);
    expect(await q.submit('x6')).toEqual({ state: 'failed', reason: 'queue_full' });
  });

  it('notifie les abonnés à chaque changement d\'état', async () => {
    const send = vi.fn(async (): Promise<PublishOutcome> => ({ ok: true }));
    const q = createUploadQueue({ store: memoryStore(), findPost: id => posts.get(id) ?? null, send, isOnline: () => true });
    const seen: string[] = [];
    q.subscribe((id, s) => seen.push(`${id}:${s.state}`));
    await q.submit('p2');
    expect(seen).toEqual(['p2:sending', 'p2:sent']);
  });
});
