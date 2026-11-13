#!/usr/bin/env node
/**
 * FOODER — récupère une vraie photo publique par restaurant, gratuitement.
 *
 * Source : le site officiel du restaurant (champ `w` de toulouse-places.json).
 * On lit les balises de partage (og:image, twitter:image), le JSON-LD puis la plus
 * grande <img> de la page. On télécharge l'image, on vérifie ses dimensions réelles,
 * et on garde la meilleure par restaurant. robots.txt est respecté, aucune protection
 * n'est contournée (403 = abandon, pas d'astuce).
 *
 * Usage :
 *   node scripts/fetch-restaurant-photos.mjs --stage=discover --limit=40
 *   node scripts/fetch-restaurant-photos.mjs --stage=download --max-download=1200
 *   node scripts/fetch-restaurant-photos.mjs --stage=all
 *
 * Sorties :
 *   data/restaurant-photos.json   manifeste (source, dimensions, fichier local)
 *   data/photos-raw/<id>.<ext>    images d'origine, avant conversion
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.join(ROOT, 'data', 'toulouse-places.json');
const MANIFEST = path.join(ROOT, 'data', 'restaurant-photos.json');
const RAW = path.join(ROOT, 'data', 'photos-raw');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }),
);
const STAGE = args.stage ?? 'all';
const LIMIT = Number(args.limit ?? 0);
const CONCURRENCY = Number(args.concurrency ?? 6);
const MAX_DOWNLOAD = Number(args['max-download'] ?? 1500);
const UA = 'Mozilla/5.0 (compatible; FooderBot/1.0; photo discovery)';
const MIN_BYTES = 15_000;
const MAX_BYTES = 6_000_000;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- réseau ---------- */

async function get(url, { timeout = 12_000, accept = 'text/html,application/xhtml+xml' } = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6' },
    signal: AbortSignal.timeout(timeout),
  });
  return res;
}

const robotsCache = new Map();
async function robotsAllows(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  if (!robotsCache.has(origin)) {
    const rules = { disallow: [], allow: [] };
    try {
      const res = await get(`${origin}/robots.txt`, { timeout: 6000, accept: 'text/plain' });
      if (res.ok) {
        const txt = await res.text();
        let applies = false;
        for (const raw of txt.split(/\r?\n/)) {
          const line = raw.replace(/#.*$/, '').trim();
          if (!line) continue;
          const [key, ...rest] = line.split(':');
          const value = rest.join(':').trim();
          if (/^user-agent$/i.test(key)) applies = value === '*' || /fooderbot/i.test(value);
          else if (applies && /^disallow$/i.test(key) && value) rules.disallow.push(value);
          else if (applies && /^allow$/i.test(key) && value) rules.allow.push(value);
        }
      }
    } catch {
      /* pas de robots.txt lisible : on considère autorisé */
    }
    robotsCache.set(origin, rules);
  }
  const { disallow, allow } = robotsCache.get(origin);
  const p = new URL(url).pathname || '/';
  const hit = (list) => list.filter((r) => p.startsWith(r)).sort((a, b) => b.length - a.length)[0];
  const d = hit(disallow);
  if (!d) return true;
  const a = hit(allow);
  return Boolean(a && a.length > d.length);
}

/* ---------- HTML ---------- */

const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
function attrsOf(tag) {
  const out = {};
  for (const m of tag.matchAll(ATTR)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}

function resolveUrl(src, base) {
  if (!src) return null;
  let s = src.trim().replace(/^&amp;/, '&');
  if (!s || /^data:/i.test(s)) return null;
  try {
    return new URL(s, base).toString();
  } catch {
    return null;
  }
}

const BAD = /(logo|favicon|sprite|placeholder|avatar|pixel|spacer|transparent|1x1|badge|icone|icon-)/i;
function usableCandidate(url, { minWidth = 0 } = {}) {
  if (!url) return false;
  if (!/^https?:/i.test(url)) return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  if (BAD.test(url)) return false;
  if (minWidth && minWidth < 300) return false;
  return true;
}

function candidatesFrom(html, pageUrl) {
  const found = [];
  const push = (url, rank, width = 0) => {
    const abs = resolveUrl(url, pageUrl);
    if (usableCandidate(abs, { minWidth: width })) found.push({ url: abs, rank, width });
  };

  const meta = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    const key = (a.property ?? a.name ?? '').toLowerCase();
    if (key) meta[key] = a.content ?? '';
  }
  // 1200x630 = carte de partage générée (souvent un visuel de marque) : moins bon qu'une photo de la page.
  const ogDims = `${meta['og:image:width'] ?? ''}x${meta['og:image:height'] ?? ''}`;
  const ogIsCard = ogDims === '1200x630' || ogDims === '630x1200';
  push(meta['og:image'], ogIsCard ? 5 : 100);
  push(meta['og:image:secure_url'] || meta['og:image:url'], ogIsCard ? 5 : 100);
  push(meta['twitter:image'] || meta['twitter:image:src'], 80);
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    const rel = (a.rel ?? '').toLowerCase();
    if (rel.includes('image_src') || (rel === 'preload' && (a.as ?? '').toLowerCase() === 'image')) push(a.href ?? '', 70);
  }
  for (const m of html.matchAll(/<script\b[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        for (const [k, v] of Object.entries(node)) {
          if (k === 'image') {
            if (typeof v === 'string') push(v, 60);
            else if (Array.isArray(v)) v.forEach((x) => (typeof x === 'string' ? push(x, 60) : walk(x)));
            else if (v && typeof v.url === 'string') push(v.url, 60);
          } else walk(v);
        }
      };
      walk(JSON.parse(m[1]));
    } catch {
      /* JSON-LD invalide : on ignore */
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    const width = Number(a.width ?? 0) || 0;
    push(a.src ?? a['data-src'] ?? a['data-original'] ?? '', 10, width);
  }

  const seen = new Set();
  return found
    .sort((a, b) => b.rank - a.rank || b.width - a.width)
    .filter((c) => (seen.has(c.url) ? false : seen.add(c.url)));
}

/* ---------- image ---------- */

function imageSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  const ascii = (a, b) => buf.toString('ascii', a, b);
  if (ascii(0, 3) === 'GIF') return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const t = ascii(12, 16);
    if (t === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (t === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}

async function inspectImage(url) {
  try {
    const res = await get(url, { timeout: 15_000, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' });
    if (!res.ok) return { error: `http ${res.status}` };
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!type.startsWith('image/')) return { error: `type ${type || 'inconnu'}` };
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return { error: `trop lourd ${len}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES) return { error: `trop petit ${buf.length}o` };
    if (buf.length > MAX_BYTES) return { error: `trop lourd ${buf.length}o` };
    const size = imageSize(buf);
    if (!size) return { error: 'dimensions illisibles' };
    const ratio = size.w / size.h;
    if (size.w < 600 || size.h < 400) return { error: `trop petit ${size.w}x${size.h}` };
    if (ratio < 0.5 || ratio > 3.2) return { error: `ratio ${ratio.toFixed(2)}` };
    // Un logo ou un aplat se compresse à presque rien : une vraie photo dépasse ~0,06 octet/pixel.
    const bpp = buf.length / (size.w * size.h);
    if (bpp < 0.06) return { error: `aplat/logo ${bpp.toFixed(3)} o/px` };
    return { ...size, bytes: buf.length, type, buf };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'timeout image' : 'image injoignable' };
  }
}

/* ---------- découverte ---------- */

async function discoverOne(rec) {
  let page = null;
  try {
    page = new URL(rec.w).toString();
  } catch {
    return { id: rec.id, status: 'bad-url' };
  }
  if (!(await robotsAllows(page))) return { id: rec.id, status: 'robots' };

  let html;
  try {
    const res = await get(page);
    if (!res.ok) return { id: rec.id, status: `http ${res.status}` };
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!type.includes('html')) return { id: rec.id, status: 'pas du html' };
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > 4_000_000) return { id: rec.id, status: 'page trop lourde' };
    html = await res.text();
    if (html.length > 4_000_000) return { id: rec.id, status: 'page trop lourde' };
  } catch (e) {
    return { id: rec.id, status: e.name === 'TimeoutError' ? 'timeout page' : 'site injoignable' };
  }

  const cands = candidatesFrom(html, page).slice(0, 8);
  for (const c of cands) {
    const img = await inspectImage(c.url);
    if (!img.error) {
      await fs.mkdir(RAW, { recursive: true });
      const ext = img.type.includes('webp') ? 'webp' : img.type.includes('png') ? 'png' : 'jpg';
      const file = path.join(RAW, `${rec.id}.${ext}`);
      await fs.writeFile(file, img.buf);
      return {
        id: rec.id,
        status: 'ok',
        name: rec.n,
        kind: rec.k,
        cuisine: rec.c,
        page,
        image: c.url,
        width: img.w,
        height: img.h,
        bytes: img.bytes,
        type: img.type,
        local: path.relative(ROOT, file).split(path.sep).join('/'),
      };
    }
  }
  return { id: rec.id, status: cands.length ? 'image refusee' : 'aucune image' };
}

/* ---------- exécution ---------- */

async function pool(items, n, fn, onDone) {
  let i = 0;
  const out = [];
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        const res = await fn(items[idx], idx);
        out[idx] = res;
        onDone?.(res, idx);
      }
    }),
  );
  return out;
}

async function discover(records) {
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true });
  const prev = new Map();
  try {
    const saved = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
    for (const e of saved) prev.set(e.id, e);
  } catch {
    /* premier passage */
  }

  const work = records.filter((r) => r.w && !prev.has(r.id));
  log(`découverte : ${work.length} sites à visiter (${prev.size} déjà faits)`);
  const results = [...prev.values()];
  const counts = {};
  let done = 0;

  const save = async () => {
    const ok = results.filter((r) => r.status === 'ok');
    await fs.writeFile(MANIFEST, JSON.stringify(ok, null, 1));
  };

  await pool(
    work.slice(0, LIMIT || work.length),
    CONCURRENCY,
    async (rec) => {
      const r = await discoverOne(rec);
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      return r;
    },
    async (r) => {
      results.push(r);
      done += 1;
      if (done % 25 === 0) {
        log(`${done}/${work.length} · ok ${results.filter((x) => x.status === 'ok').length}`);
        if (done % 200 === 0) await save();
      }
    },
  );
  await save();
  const ok = results.filter((r) => r.status === 'ok');
  log(`terminé : ${ok.length} photos trouvées`);
  log(
    'échecs :',
    Object.entries(counts)
      .filter(([k]) => k !== 'ok')
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(' · '),
  );
}

async function download() {
  await fs.mkdir(RAW, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const done = new Set();
  for (const f of await fs.readdir(RAW)) done.add(f.replace(/\.[a-z0-9]+$/i, ''));

  const todo = manifest.filter((e) => e.status === 'ok' && !done.has(e.id)).slice(0, MAX_DOWNLOAD);
  log(`téléchargement : ${todo.length} images`);
  let ok = 0;

  await pool(
    todo,
    CONCURRENCY,
    async (e) => {
      const img = await inspectImage(e.image);
      if (img.error) return { id: e.id, error: img.error };
      const ext = img.type.includes('webp') ? 'webp' : img.type.includes('png') ? 'png' : 'jpg';
      const file = path.join(RAW, `${e.id}.${ext}`);
      await fs.writeFile(file, img.buf);
      return { id: e.id, file: path.relative(ROOT, file).split(path.sep).join('/'), bytes: img.bytes };
    },
    async (r) => {
      if (r.file) {
        e_file.set(r.id, r.file);
        ok += 1;
      }
      if (ok % 50 === 0 && ok) log(`${ok} téléchargées`);
    },
  );

  for (const e of manifest) {
    const f = e_file.get(e.id);
    if (f) e.local = f;
  }
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
  log(`téléchargé : ${ok}`);
}

const e_file = new Map();

/* ---------- main ---------- */

const records = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (STAGE === 'discover' || STAGE === 'all') await discover(records);
if (STAGE === 'download' || STAGE === 'all') await download();
if (STAGE === 'discover') {
  const m = JSON.parse(await fs.readFile(MANIFEST, 'utf8').catch(() => '[]'));
  log(`manifeste : ${m.length} photos`);
}
