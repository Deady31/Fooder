// Étape 4 : fusionne les classes écrites par les sous-agents (data/review/photo-class/*.json) avec l'index des planches
// (data/review/photo-sheets/*.json) dans data/photo-vision.json : { clé: { classe, confiance, verdict, file } }.
//   node scripts/photos-merge.mjs
// Le fichier versionné ne garde que clé → classe/confiance/verdict (sans chemin local) ; les chemins restent dans data/review/.
import fs from 'node:fs';
import { parseVisionRows, visionVerdict } from './lib/photoSelect.mjs';

const SHEETS = 'data/review/photo-sheets';
const CLASSDIR = 'data/review/photo-class';
const out = fs.existsSync('data/photo-vision.json') ? JSON.parse(fs.readFileSync('data/photo-vision.json', 'utf8')) : {};
const local = fs.existsSync('data/review/photo-vision-files.json') ? JSON.parse(fs.readFileSync('data/review/photo-vision-files.json', 'utf8')) : {};
let n = 0, missing = 0;
const order = fs.readdirSync(SHEETS).filter(x => x.endsWith('.json')).sort((a, b) => Number(a.startsWith('rev-')) - Number(b.startsWith('rev-')) || (a < b ? -1 : 1));
for (const f of order) {
  const cf = `${CLASSDIR}/${f}`;
  if (!fs.existsSync(cf)) { if (!/^(rev|chk[0-9]*)-/.test(f)) missing++; continue; }
  const index = JSON.parse(fs.readFileSync(`${SHEETS}/${f}`, 'utf8'));
  if (!fs.existsSync(`${SHEETS}/${f}`)) continue;
  const rows = new Map(parseVisionRows(fs.readFileSync(cf, 'utf8')).map(r => [r.idx, r]));
  for (const it of index) {
    const r = rows.get(it.idx);
    const second = /^(rev|chk[0-9]*)-/.test(f);
    // Second avis (modèle plus fort) : tranche, plus de « review » ; « plat » gardé à 0,75 ou plus.
    const verdict = second ? (r?.classe === 'plat' && r.confiance >= 0.75 ? 'keep' : 'reject') : visionVerdict(r);
    out[it.key] = { classe: r?.classe ?? 'inconnu', confiance: r?.confiance ?? 0, verdict, ...(second ? { second: true } : {}) };
    local[it.key] = it.file;
    n++;
  }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync('data/photo-vision.json', JSON.stringify(sorted, null, 1) + '\n');
fs.writeFileSync('data/review/photo-vision-files.json', JSON.stringify(local));
const count = {};
for (const v of Object.values(sorted)) { const k = `${v.classe}/${v.verdict}`; count[k] = (count[k] ?? 0) + 1; }
console.log(`${n} fusionnées, planches sans classe : ${missing}`, count);
