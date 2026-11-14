#!/usr/bin/env node
/**
 * Construit les photos servies par l'app :
 *   public/restaurant-photos/<id>.jpg (originaux du fondateur, jamais modifiés)
 *     -> public/restos/<id>.webp (720 px max, qualité 68, sans EXIF, suivi par git)
 *     -> data/photos-consented.json { id: { src, kind, credit, page, consentedAt } }
 * Écarte les visuels de marque probables (scripts/photo-quality.mjs) dans data/photo-blocklist.json
 * (entrées manuelles conservées). Les entrées kind:'dish' (envoyées par les restaurateurs) sont conservées telles quelles.
 *
 * Options : --limit=N  --dry-run  --size=720  --quality=68  --no-auto-block  --force (reconvertit les webp existants)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { qualityReasons } from './photo-quality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const flag = (name) => args.includes(`--${name}`);
const LIMIT = opt('limit', Infinity);
const SIZE = opt('size', 720);
const QUALITY = opt('quality', 68);
const DRY = flag('dry-run');
const CONSENTED_AT = '2026-11-13';
const SRC_DIR = path.join(ROOT, 'public', 'restaurant-photos');
const OUT_DIR = path.join(ROOT, 'public', 'restos');

const readJson = async (rel, fallback) => {
  try {
    return JSON.parse((await fs.readFile(path.join(ROOT, rel), 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
};
const writeJson = (rel, data) => fs.writeFile(path.join(ROOT, rel), JSON.stringify(data, null, 1) + '\n');

function convert(input, output) {
  const vf = `scale='min(${SIZE},iw)':'min(${SIZE},ih)':force_original_aspect_ratio=decrease`;
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', vf, '-map_metadata', '-1', '-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `ffmpeg ${code}`))));
  });
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const local = await readJson('data/photos-local.json', {});
const manifest = new Map((await readJson('data/restaurant-photos.json', [])).map((e) => [e.id, e]));
const stats = new Map((await readJson('data/photo-stats.json', [])).map((s) => [s.id, s]));
const prevTable = await readJson('data/photos-consented.json', {});
const blocklist = await readJson('data/photo-blocklist.json', { version: 1, blocked: {} });
blocklist.blocked ??= {};

// 1. Blocage qualité automatique (les entrées manuelles ne sont jamais touchées)
if (!flag('no-auto-block')) {
  for (const [id, b] of Object.entries(blocklist.blocked)) if (b.source === 'auto') delete blocklist.blocked[id];
  for (const id of Object.keys(local)) {
    if (blocklist.blocked[id]) continue;
    const reasons = qualityReasons(stats.get(id), manifest.get(id));
    if (reasons.length) blocklist.blocked[id] = { reason: reasons.join(', '), source: 'auto', at: CONSENTED_AT };
  }
}

// 2. Conversion
const ids = Object.keys(local).filter((id) => !blocklist.blocked[id]).slice(0, LIMIT);
const table = {};
for (const [id, p] of Object.entries(prevTable)) if (p.kind === 'dish') table[id] = p; // priorité aux plats envoyés par les restos
if (!DRY) await fs.mkdir(OUT_DIR, { recursive: true });

let converted = 0, skipped = 0, failed = 0;
await pool(ids, 8, async (id) => {
  if (table[id]?.kind === 'dish') return;
  const out = path.join(OUT_DIR, `${id}.webp`);
  if (!DRY) {
    const exists = await fs.access(out).then(() => true, () => false);
    if (exists && !flag('force')) skipped += 1;
    else {
      try { await convert(path.join(SRC_DIR, `${id}.jpg`), out); converted += 1; }
      catch (e) { failed += 1; console.error(`échec ${id}: ${e.message}`); return; }
    }
  } else converted += 1;
  table[id] = { src: `/restos/${id}.webp`, kind: 'site', credit: local[id].credit, page: local[id].page, consentedAt: CONSENTED_AT };
});

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)));
const blocked = Object.keys(blocklist.blocked).length;
let bytes = 0;
if (!DRY) {
  await writeJson('data/photos-consented.json', sorted);
  await writeJson('data/photo-blocklist.json', blocklist);
  for (const f of await fs.readdir(OUT_DIR)) bytes += (await fs.stat(path.join(OUT_DIR, f))).size;
}
console.log(`${DRY ? '[dry-run] ' : ''}${Object.keys(sorted).length} photos dans la table · ${converted} converties · ${skipped} déjà là · ${failed} échecs · ${blocked} écartées (blocklist)`);
if (!DRY) console.log(`public/restos : ${(bytes / 1e6).toFixed(1)} Mo (${SIZE} px, q${QUALITY})`);
