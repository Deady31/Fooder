// Étape 4 : planche de contrôle humain — 100 photos servies tirées au hasard (graine fixe), numérotées.
//   node scripts/photos-control.mjs [--n=100] [--seed=7]  →  data/review/controle-100.jpg + controle-100.json
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadTs } from './lib/loadTs.mjs';

const arg = (k, d) => Number((process.argv.find(a => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? d) || d;
const N = arg('n', 100);
let seed = arg('seed', 7);
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const { isPresentable } = await loadTs('lib/osm.ts');
const places = JSON.parse(fs.readFileSync('data/toulouse-places.json', 'utf8'));
const table = JSON.parse(fs.readFileSync('data/photos-consented.json', 'utf8'));
const blocked = JSON.parse(fs.readFileSync('data/photo-blocklist.json', 'utf8')).blocked ?? {};
const served = places.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r) && table[r.id] && !blocked[r.id]);
const pick = [...served].sort(() => rnd() - 0.5).slice(0, N);
const T = 160, COLS = 10;
const font = 'C\\:/Windows/Fonts/arialbd.ttf';
const inputs = pick.flatMap(r => ['-i', `public/restos/${r.id}.webp`]);
const parts = pick.map((_, i) => `[${i}:v]scale=${T}:${T}:force_original_aspect_ratio=decrease,pad=${T}:${T}:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=fontfile='${font}':text='${i + 1}':x=4:y=4:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=3[v${i}]`);
const layout = pick.map((_, i) => `${(i % COLS) * T}_${Math.floor(i / COLS) * T}`).join('|');
const graph = `${parts.join(';')};${pick.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${pick.length}:layout=${layout}[out]`;
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-q:v', '3', 'data/review/controle-100.jpg'], { encoding: 'utf8', maxBuffer: 1 << 24 });
if (r.status !== 0) { console.error(r.stderr.slice(0, 400)); process.exit(1); }
fs.writeFileSync('data/review/controle-100.json', JSON.stringify(pick.map((p, i) => ({ n: i + 1, id: p.id, nom: p.n })), null, 1));
console.log(`${pick.length} photos tirées parmi ${served.length} fiches servies avec photo → data/review/controle-100.jpg`);
