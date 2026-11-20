// Construit data/photos-fallback.json : photos de SECOURS (façade, intérieur, logo) de l'établissement exact, tirées des
// photos écartées par le tri vision. Remplacées automatiquement dès qu'un plat arrive (priorité « ambiance » la plus basse).
//   node scripts/build-fallback-photos.mjs [--dry-run]
// Exclus : menu, carte, personnes, « autre », filtres automatiques, images partagées entre fiches (octets ou page identiques),
// fiches qui ont déjà une photo de plat servie, retraits.
import fs from 'node:fs';
import crypto from 'node:crypto';

const DRY = process.argv.includes('--dry-run');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const photos = readJson('data/photos-consented.json');
const blocked = readJson('data/photo-blocklist.json').blocked ?? {};
const consent = readJson('data/photo-consent.json');
const revoked = new Set(consent.revoked ?? []);
const ALLOWED = ['facade', 'interieur', 'logo'];

const cands = {};
const counts = { facade: 0, interieur: 0, logo: 0, partage: 0, fichierAbsent: 0 };
for (const [id, b] of Object.entries(blocked)) {
  if (b.source !== 'vision' || revoked.has(id)) continue;
  const classe = ALLOWED.find(c => (b.reason ?? '').includes(`: ${c} (`));
  const p = photos[id];
  if (!classe || !p?.src) continue;
  const file = `public${p.src}`;
  if (!fs.existsSync(file)) { counts.fichierAbsent++; continue; }
  cands[id] = { src: p.src, classe, md5: crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex'), page: String(p.page ?? '').toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '') };
}
// Octets ou page identiques entre fiches (secours ET photos servies) : écartés.
const servedHash = new Set(), servedPage = new Set();
for (const [id, p] of Object.entries(photos)) {
  if (blocked[id] || !p?.src || !fs.existsSync(`public${p.src}`)) continue;
  servedHash.add(crypto.createHash('md5').update(fs.readFileSync(`public${p.src}`)).digest('hex'));
  if (p.page) servedPage.add(String(p.page).toLowerCase().replace(/#.*$/, '').replace(/\/+$/, ''));
}
const hashN = {}, pageN = {};
for (const c of Object.values(cands)) { hashN[c.md5] = (hashN[c.md5] ?? 0) + 1; if (c.page) pageN[c.page] = (pageN[c.page] ?? 0) + 1; }
const out = {};
for (const [id, c] of Object.entries(cands).sort(([a], [b]) => (a < b ? -1 : 1))) {
  if (hashN[c.md5] > 1 || servedHash.has(c.md5) || (c.page && (pageN[c.page] > 1 || servedPage.has(c.page)))) { counts.partage++; continue; }
  out[id] = { src: c.src, classe: c.classe };
  counts[c.classe]++;
}
console.log(JSON.stringify(counts), 'total', Object.keys(out).length);
if (!DRY) fs.writeFileSync('data/photos-fallback.json', JSON.stringify(out, null, 1) + '\n');
