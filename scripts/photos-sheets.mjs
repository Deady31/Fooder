// Étape 4 : planches-contacts numérotées (6×6 = 36 images) pour le tri par vision.
//   node scripts/photos-sheets.mjs [--existing] [--review]
//   - par défaut : les candidates téléchargées (data/cache/photo-files.json), planches « sheet-NNN » ;
//   - --existing : seulement les photos déjà servies ou bloquées avec original (public/restaurant-photos/<id>.jpg, clé « id#0 ») ;
//   - --review   : planches des cas « second avis » (confiance moyenne), issues de data/review/photo-class/.
// Sortie : data/review/photo-sheets/sheet-NNN.jpg + sheet-NNN.json (index : numéro → clé). Les sous-agents écrivent
// data/review/photo-class/sheet-NNN.json : [{idx, classe, confiance}]. Les planches déjà classées ne sont pas refaites.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chunk, parseVisionRows } from './lib/photoSelect.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SHEETS = 'data/review/photo-sheets';
const CLASSDIR = 'data/review/photo-class';
const TILE = 220;
const PER = 36;
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf';
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

/** Éléments à classer : { key, file }. */
function pool() {
  const items = [];
  if (args.served) {
    // Contrôle strict final : toutes les photos actuellement servies (WebP convertis).
    const consented = readJson('data/photos-consented.json', {});
    const blocked = readJson('data/photo-blocklist.json', {}).blocked ?? {};
    for (const id of Object.keys(consented)) if (!blocked[id] && !readJson('data/photo-vision.json', {})[`${id}#chk`] && fs.existsSync(`public/restos/${id}.webp`)) items.push({ key: `${id}#chk`, file: `public/restos/${id}.webp` });
    return items.sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  if (args.review) {
    const vision = readJson('data/photo-vision.json', {});
    const local = readJson('data/review/photo-vision-files.json', {});
    for (const [key, v] of Object.entries(vision)) if (v.verdict === 'review' && local[key] && !v.second) items.push({ key, file: local[key] });
    return items.sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  if (!args.existing) {
    const files = readJson('data/cache/photo-files.json', {});
    const known = readJson('data/photo-vision.json', {});
    for (const [key, f] of Object.entries(files)) if (!key.endsWith('#done') && !known[key]) items.push({ key, file: f.file });
  } else {
    const consented = readJson('data/photos-consented.json', {});
    const blocked = readJson('data/photo-blocklist.json', {}).blocked ?? {};
    for (const id of new Set([...Object.keys(consented), ...Object.keys(blocked)])) {
      const f = `public/restaurant-photos/${id}.jpg`;
      if (fs.existsSync(f)) items.push({ key: `${id}#0`, file: f });
    }
  }
  return items.sort((a, b) => (a.key < b.key ? -1 : 1));
}

function buildSheet(name, lot) {
  const cols = 6;
  const inputs = lot.flatMap(it => ['-i', it.file]);
  const parts = lot.map((_, i) =>
    `[${i}:v]scale=${TILE}:${TILE}:force_original_aspect_ratio=decrease,pad=${TILE}:${TILE}:(ow-iw)/2:(oh-ih)/2:color=black,` +
    `drawtext=fontfile='${FONT}':text='${i + 1}':x=6:y=6:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=4[v${i}]`);
  const layout = lot.map((_, i) => `${(i % cols) * TILE}_${Math.floor(i / cols) * TILE}`).join('|');
  const graph = `${parts.join(';')};${lot.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${lot.length}:layout=${layout}[out]`;
  const out = path.join(SHEETS, `${name}.jpg`);
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-q:v', '4', out], { encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status !== 0) return { ok: false, err: (r.stderr ?? '').slice(0, 300) };
  return { ok: true };
}

fs.mkdirSync(SHEETS, { recursive: true });
fs.mkdirSync(CLASSDIR, { recursive: true });
const items = pool();
const prefix = args.tag ? String(args.tag) : args.served ? 'chk' : args.review ? 'rev' : args.existing ? 'ex' : 'sheet';
// Numérotation stable : la planche n reçoit les éléments [36n, 36n+36[ du tri par clé.
let made = 0, skipped = 0, failed = 0;
for (const [n, lot] of chunk(items, PER).entries()) {
  const name = `${prefix}-${String(n + 1).padStart(3, '0')}`;
  const idxFile = path.join(SHEETS, `${name}.json`);
  const done = fs.existsSync(path.join(CLASSDIR, `${name}.json`)) && parseVisionRows(fs.readFileSync(path.join(CLASSDIR, `${name}.json`), 'utf8')).length > 0;
  if (done) { skipped++; continue; }
  const files = lot.map(it => it.file).filter(f => fs.existsSync(f));
  if (files.length !== lot.length) { console.error(`${name} : fichier manquant`); failed++; continue; }
  const res = buildSheet(name, lot);
  if (!res.ok) { console.error(`${name} : ${res.err}`); failed++; continue; }
  fs.writeFileSync(idxFile, JSON.stringify(lot.map((it, i) => ({ idx: i + 1, key: it.key, file: it.file }))));
  made++;
}
console.log(`${items.length} images → planches créées ${made}, déjà classées ${skipped}, échecs ${failed}`);
