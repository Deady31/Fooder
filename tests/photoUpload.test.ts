import { describe, expect, it } from 'vitest';
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_MAX_BYTES,
  PUBLISH_MESSAGES,
  classifyPublishError,
  decodeDataUrl,
  photoPathFor,
  preparePhoto,
} from '../lib/cloud/photoUpload';
import { encodeWithinLimits } from '../lib/feed';
import { newPostId } from '../lib/share';

/*
 * Contraintes SERVEUR recopiées ici comme documentation (toute divergence client / serveur doit casser un test) :
 *
 * 20261111000000_accounts.sql
 *   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 *   values ('photos', 'photos', true, 1572864, array['image/jpeg', 'image/webp'])
 *   posts.photo_path check (photo_path is null or photo_path ~ ('^' || user_id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|webp)$'))
 *   posts.id uuid primary key ; restaurant_id <= 40 ; restaurant_name <= 60 ; cuisine <= 40 ; caption <= 140 ;
 *   verdict in ('miam', 'bof', 'atester')
 *
 * 20261112000000_anonymous.sql (politique « photos: déposer dans son dossier »)
 *   bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
 *   and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|webp)$')
 *   and public.photo_upload_allowed()   -- 5 fichiers / 24 h pour un anonyme, 30 sinon
 *   guard_post : 'daily post limit reached' au-delà de 5 posts / jour (anonyme) ou 30
 */
const SERVER_FILE_SIZE_LIMIT = 1572864;
const SERVER_MIME = ['image/jpeg', 'image/webp'];
const serverPathRegex = (uid: string) => new RegExp('^' + uid + '/[A-Za-z0-9_-]{1,64}\\.(jpg|webp)$');

const UID = '3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f'; // forme de auth.uid()::text (minuscules, tirets)

// JPEG minimal (marqueurs SOI/EOI) encodé en base64
const tinyJpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString('base64');
const tinyJpeg = `data:image/jpeg;base64,${tinyJpegB64}`;

describe('contraintes serveur recopiées', () => {
  it('limite de poids et types MIME identiques au bucket', () => {
    expect(PHOTO_MAX_BYTES).toBeLessThanOrEqual(SERVER_FILE_SIZE_LIMIT);
    expect([...PHOTO_ALLOWED_MIME].sort()).toEqual([...SERVER_MIME].sort());
  });
});

describe('decodeDataUrl (sans fetch : la CSP connect-src bloque fetch("data:..."))', () => {
  it('décode un data URL JPEG en octets', () => {
    const d = decodeDataUrl(tinyJpeg);
    expect(d).not.toBeNull();
    expect(d!.mime).toBe('image/jpeg');
    expect(Array.from(d!.bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  });

  it('refuse ce qui n\'est pas un data URL image base64', () => {
    expect(decodeDataUrl('https://x/y.jpg')).toBeNull();
    expect(decodeDataUrl('data:text/plain;base64,aGVsbG8=')).toBeNull();
    expect(decodeDataUrl('data:image/jpeg;base64,@@@')).toBeNull();
    expect(decodeDataUrl('')).toBeNull();
  });

  it('normalise image/jpg en image/jpeg', () => {
    expect(decodeDataUrl(`data:image/jpg;base64,${tinyJpegB64}`)!.mime).toBe('image/jpeg');
  });
});

describe('photoPathFor : chemin conforme à la regex du serveur', () => {
  it('uuid de post (newPostId) + jpeg => accepté par la regex serveur, 50 tirages', () => {
    for (let i = 0; i < 50; i++) {
      const path = photoPathFor(UID, newPostId(), 'image/jpeg');
      expect(path).not.toBeNull();
      expect(serverPathRegex(UID).test(path!)).toBe(true);
    }
  });

  it('webp => extension .webp acceptée', () => {
    const path = photoPathFor(UID, newPostId(), 'image/webp');
    expect(path!.endsWith('.webp')).toBe(true);
    expect(serverPathRegex(UID).test(path!)).toBe(true);
  });

  it('refuse png / heic (rejetés par le bucket) et les id ou uid invalides', () => {
    expect(photoPathFor(UID, newPostId(), 'image/png')).toBeNull();
    expect(photoPathFor(UID, newPostId(), 'image/heic')).toBeNull();
    expect(photoPathFor(UID, '../evil', 'image/jpeg')).toBeNull();
    expect(photoPathFor(UID, 'a'.repeat(65), 'image/jpeg')).toBeNull();
    expect(photoPathFor('', newPostId(), 'image/jpeg')).toBeNull();
    expect(photoPathFor('UID/../x', newPostId(), 'image/jpeg')).toBeNull();
  });
});

describe('preparePhoto : poids et format avant envoi', () => {
  it('JPEG valide => chemin conforme, Blob du bon type', () => {
    const r = preparePhoto(UID, newPostId(), tinyJpeg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(serverPathRegex(UID).test(r.path)).toBe(true);
    expect(SERVER_MIME).toContain(r.mime);
    expect(r.bytes.byteLength).toBe(8);
  });

  it('PNG => bad_format ; trop lourd => too_big', () => {
    const png = `data:image/png;base64,${tinyJpegB64}`;
    expect(preparePhoto(UID, newPostId(), png)).toEqual({ ok: false, reason: 'bad_format' });
    const big = `data:image/jpeg;base64,${Buffer.alloc(SERVER_FILE_SIZE_LIMIT + 1).toString('base64')}`;
    expect(preparePhoto(UID, newPostId(), big)).toEqual({ ok: false, reason: 'too_big' });
  });
});

describe('classifyPublishError', () => {
  it('hors-ligne / réseau', () => {
    expect(classifyPublishError({ message: 'Failed to fetch' })).toBe('offline');
    expect(classifyPublishError({ message: 'x' }, { online: false })).toBe('offline');
    expect(classifyPublishError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('offline');
  });

  it('session absente ou jeton expiré', () => {
    expect(classifyPublishError({ message: 'JWT expired', statusCode: '401' })).toBe('no_session');
    expect(classifyPublishError({ status: 401, message: 'Unauthorized' })).toBe('no_session');
  });

  it('quota : trigger guard_post ou politique de stockage (RLS)', () => {
    expect(classifyPublishError({ message: 'daily post limit reached', code: 'P0001' })).toBe('quota');
    expect(classifyPublishError({ message: 'new row violates row-level security policy', statusCode: '403' })).toBe('quota');
  });

  it('trop lourd / format refusé par le bucket', () => {
    expect(classifyPublishError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' })).toBe('too_big');
    expect(classifyPublishError({ message: 'mime type image/png is not supported', statusCode: '415' })).toBe('bad_format');
  });

  it('le reste => erreur serveur', () => {
    expect(classifyPublishError({ message: 'boom', code: '23514' })).toBe('server');
    expect(classifyPublishError(null)).toBe('server');
  });

  it('chaque cause a un message français dédié, distinct du message générique d\'avant', () => {
    for (const msg of Object.values(PUBLISH_MESSAGES)) {
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/pas encore en ligne\. Tu pourras réessayer plus tard/);
    }
  });
});

describe('encodeWithinLimits (compression)', () => {
  const fakeEncoder = (sizes: Record<string, number>, unsupported: string[] = []) => (mime: string, q: number, scale: number) => {
    const used = unsupported.includes(mime) ? 'image/png' : mime;
    const bytes = Math.round((sizes[used] ?? 1000) * q * scale * scale);
    return `data:${used};base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;
  };

  it('JPEG sous la limite : gardé tel quel', () => {
    const out = encodeWithinLimits(fakeEncoder({ 'image/jpeg': 200_000 }), 0.72);
    expect(out!.startsWith('data:image/jpeg')).toBe(true);
  });

  it('navigateur sans encodeur JPEG (repli PNG) : bascule en WebP', () => {
    const out = encodeWithinLimits(fakeEncoder({ 'image/webp': 100_000 }, ['image/jpeg']), 0.72);
    expect(out!.startsWith('data:image/webp')).toBe(true);
  });

  it('trop lourd : baisse qualité / taille jusqu\'à passer sous la limite serveur', () => {
    const out = encodeWithinLimits(fakeEncoder({ 'image/jpeg': 6_000_000 }), 0.72)!;
    expect(out.startsWith('data:image/jpeg')).toBe(true);
    expect(Math.floor((out.length - 'data:image/jpeg;base64,'.length) * 3 / 4)).toBeLessThanOrEqual(SERVER_FILE_SIZE_LIMIT);
  });

  it('aucun format accepté par le serveur : null (message clair côté UI)', () => {
    expect(encodeWithinLimits(fakeEncoder({}, ['image/jpeg', 'image/webp']), 0.72)).toBeNull();
  });
});
