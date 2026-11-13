import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishPostOnline } from '../lib/cloud/publish';
import { publishCloudPost, postRow } from '../lib/cloud/social';
import type { FeedPost } from '../lib/feed';

const UID = '3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f';
const POST_ID = '0b9d7c1e-2a3f-4b5c-8d6e-7f8091a2b3c4';
const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;

const post = (over: Partial<FeedPost> = {}): FeedPost => ({
  id: POST_ID,
  author: { name: 'x', avatar: { id: 'burger', bg: 'lemon' }, level: 1 },
  restaurantId: 'osm-node-123',
  restaurantName: 'Chez Test',
  cuisine: 'Burger',
  sticker: 'burger',
  caption: 'Top',
  verdict: 'miam',
  photo: jpeg,
  likes: 0,
  createdAt: 1,
  mine: true,
  ...over,
});

interface FakeOpts {
  existing?: boolean;
  uploadError?: unknown;
  insertError?: unknown;
  listed?: string[];
}

/** Faux client Supabase en mémoire : AUCUN appel réseau. */
function fakeClient(o: FakeOpts = {}) {
  const uploads: { path: string; body: Blob; opts: { contentType: string } }[] = [];
  const inserts: unknown[] = [];
  const client = {
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: o.existing ? { id: POST_ID } : null, error: null }) }) }),
      insert: async (row: unknown) => {
        inserts.push(row);
        return { error: o.insertError ?? null };
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string, body: Blob, opts: { contentType: string }) => {
          uploads.push({ path, body, opts });
          return { data: o.uploadError ? null : { path }, error: o.uploadError ?? null };
        },
        list: async () => ({ data: (o.listed ?? []).map(name => ({ name })), error: null }),
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, uploads, inserts };
}

const SERVER_PATH = new RegExp('^' + UID + '/[A-Za-z0-9_-]{1,64}\\.(jpg|webp)$');

describe('publishCloudPost (faux client, aucun réseau)', () => {
  it('envoie la photo SANS fetch(data:) puis le post, chemin et MIME conformes au serveur', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const f = fakeClient();
    const r = await publishCloudPost(post(), UID, f.client);
    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(f.uploads).toHaveLength(1);
    expect(SERVER_PATH.test(f.uploads[0].path)).toBe(true);
    expect(['image/jpeg', 'image/webp']).toContain(f.uploads[0].opts.contentType);
    expect(f.uploads[0].body.size).toBe(4);
    expect(f.inserts[0]).toMatchObject({ id: POST_ID, user_id: UID, photo_path: f.uploads[0].path });
  });

  it('idempotent : post déjà en ligne => succès sans nouvel envoi', async () => {
    const f = fakeClient({ existing: true });
    expect(await publishCloudPost(post(), UID, f.client)).toEqual({ ok: true });
    expect(f.uploads).toHaveLength(0);
    expect(f.inserts).toHaveLength(0);
  });

  it('reprise : fichier déjà déposé (409) => on insère le post quand même', async () => {
    const f = fakeClient({ uploadError: { statusCode: '409', message: 'The resource already exists' } });
    expect(await publishCloudPost(post(), UID, f.client)).toEqual({ ok: true });
    expect(f.inserts).toHaveLength(1);
  });

  it('insertion déjà faite (23505) => succès', async () => {
    const f = fakeClient({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    expect(await publishCloudPost(post(), UID, f.client)).toEqual({ ok: true });
  });

  it('plafond du stockage (RLS) => quota, post non inséré', async () => {
    const f = fakeClient({ uploadError: { statusCode: '403', message: 'new row violates row-level security policy' } });
    expect(await publishCloudPost(post(), UID, f.client)).toEqual({ ok: false, reason: 'quota' });
    expect(f.inserts).toHaveLength(0);
  });

  it('quota de posts (trigger guard_post) => quota', async () => {
    const f = fakeClient({ insertError: { code: 'P0001', message: 'daily post limit reached' } });
    expect(await publishCloudPost(post(), UID, f.client)).toEqual({ ok: false, reason: 'quota' });
  });

  it('PNG refusé avant tout envoi', async () => {
    const f = fakeClient();
    const r = await publishCloudPost(post({ photo: jpeg.replace('image/jpeg', 'image/png') }), UID, f.client);
    expect(r).toEqual({ ok: false, reason: 'bad_format' });
    expect(f.uploads).toHaveLength(0);
  });

  it('postRow respecte les longueurs SQL', () => {
    const row = postRow(post({ restaurantId: 'r'.repeat(80), restaurantName: 'n'.repeat(90), cuisine: 'c'.repeat(90), caption: 'x'.repeat(300) }), UID, null);
    expect(row.restaurant_id.length).toBeLessThanOrEqual(40);
    expect(row.restaurant_name.length).toBeLessThanOrEqual(60);
    expect(row.cuisine.length).toBeLessThanOrEqual(40);
    expect(row.caption.length).toBeLessThanOrEqual(140);
  });
});

describe('publishPostOnline : causes claires', () => {
  const ok = async () => ({ ok: true });
  it('hors-ligne : aucune tentative', async () => {
    const ensure = vi.fn();
    expect(await publishPostOnline(post(), { ensure, publish: ok, isOnline: () => false })).toEqual({ ok: false, reason: 'offline' });
    expect(ensure).not.toHaveBeenCalled();
  });

  it('session anonyme impossible : no_session avec le message de la session', async () => {
    const r = await publishPostOnline(post(), {
      ensure: async () => ({ ok: false, reason: 'anon_disabled', message: 'désactivé' }),
      publish: ok,
      isOnline: () => true,
    });
    expect(r).toEqual({ ok: false, reason: 'no_session', message: 'désactivé' });
  });

  it('erreur réseau pendant la session : offline ; cloud absent : cloud_off', async () => {
    expect(await publishPostOnline(post(), { ensure: async () => ({ ok: false, reason: 'network' }), publish: ok, isOnline: () => true })).toEqual({ ok: false, reason: 'offline' });
    expect(await publishPostOnline(post(), { ensure: async () => ({ ok: false, reason: 'cloud_off' }), publish: ok, isOnline: () => true })).toEqual({ ok: false, reason: 'cloud_off' });
  });

  it('exception inattendue => classée, jamais avalée en message générique', async () => {
    const r = await publishPostOnline(post(), {
      ensure: async () => ({ ok: true, uid: UID }),
      publish: async () => {
        throw new TypeError('Failed to fetch');
      },
      isOnline: () => true,
    });
    expect(r).toEqual({ ok: false, reason: 'offline' });
  });
});
