// Étape 4 : choisit la meilleure photo de plat par fiche, convertit, met à jour les tables servies.
//   node scripts/photos-select.mjs [--dry-run]
// Entrées : data/photo-vision.json (classes), data/cache/photo-files.json (candidates), photos existantes
// (public/restaurant-photos/<id>.jpg, clé « id#0 »). Sorties : public/restos/<id>.webp, data/photos-consented.json,
// data/photo-blocklist.json (source « vision »), data/review/photo-selection.json (rapport).
// Règles : une photo servie doit être de classe « plat » (vision) ; on garde l'existante si elle est bonne ;
// une image partagée entre restaurants de noms différents est écartée.
import fs from 'node:fs';
import { loadTs } from './lib/loadTs.mjs';
import { nameKey } from './lib/addressAudit.mjs';
import { dHash, ffprobeSize, toWebp } from './lib/imageTools.mjs';
import { pickBest, sharedImages } from './lib/photoSelect.mjs';

const DRY = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10);
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')) : d);
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');

const vision = readJson('data/photo-vision.json', {});
const localFiles = readJson('data/review/photo-vision-files.json', {});
const newMeta = readJson('data/cache/photo-files.json', {});
const consented = readJson('data/photos-consented.json', {});
const blocklist = readJson('data/photo-blocklist.json', { version: 1, blocked: {} });
blocklist.blocked ??= {};
const places = readJson('data/toulouse-places.json', []);
const byId = new Map(places.map(r => [r.id, r]));
const { isPresentable } = await loadTs('lib/osm.ts');
const nameOf = id => nameKey(byId.get(id)?.n ?? id);

// Candidates « plat » validées, avec leurs mesures.
const cands = [];
for (const [key, v] of Object.entries(vision)) {
  if (v.verdict !== 'keep') continue;
  const id = key.split('#')[0];
  const file = localFiles[key];
  if (!file || !fs.existsSync(file) || !byId.has(id)) continue;
  const meta = newMeta[key];
  const { width, height } = meta ?? ffprobeSize(file);
  cands.push({ key, id, file, existing: key.endsWith('#0'), confiance: v.confiance, width, height, bytes: meta?.bytes ?? fs.statSync(file).size, hash: meta?.hash ?? dHash(file), url: meta?.url, page: meta?.page });
}
const withHash = cands.filter(c => c.hash);
const { dropped, chain } = sharedImages(withHash, nameOf);
const usable = withHash.filter(c => !dropped.has(c.key));

const perId = new Map();
for (const c of usable) (perId.get(c.id) ?? perId.set(c.id, []).get(c.id)).push(c);

const report = { converted: [], kept: [], unblocked: [], blocked: [], sharedDropped: [...dropped], chain: [...chain] };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'site du restaurant'; } };
const visionOf = key => ({ classe: vision[key].classe, confiance: vision[key].confiance });

for (const [id, list] of perId) {
  const cur = consented[id];
  if (cur?.kind === 'dish') continue; // plat envoyé par le restaurant : jamais touché
  const existing = list.find(c => c.existing);
  const best = existing ?? pickBest(list.filter(c => !c.existing));
  if (!best) continue;
  if (best.existing) {
    const wasBlocked = Boolean(blocklist.blocked[id]);
    if (wasBlocked || !cur) {
      const out = `public/restos/${id}.webp`;
      if (!DRY && !fs.existsSync(out)) toWebp(best.file, out);
      delete blocklist.blocked[id];
      const prev = readJson('data/photos-local.json', {})[id];
      consented[id] = { src: `/restos/${id}.webp`, kind: 'site', credit: prev?.credit ?? 'site du restaurant', page: prev?.page ?? '', consentedAt: cur?.consentedAt ?? TODAY, vision: visionOf(best.key) };
      report.unblocked.push(id);
    } else {
      consented[id] = { ...cur, vision: visionOf(best.key) };
      report.kept.push(id);
    }
  } else {
    if (!DRY) { fs.mkdirSync('public/restos', { recursive: true }); toWebp(best.file, `public/restos/${id}.webp`); }
    delete blocklist.blocked[id];
    consented[id] = { src: `/restos/${id}.webp`, kind: 'site', credit: hostOf(best.page ?? best.url ?? ''), page: best.page ?? '', consentedAt: TODAY, vision: visionOf(best.key) };
    report.converted.push(id);
  }
}

// Photos servies sans aucune « plat » validée : retirées du service (blocklist « vision »), fichiers laissés en place.
for (const id of Object.keys(consented)) {
  if (consented[id].kind === 'dish' || perId.has(id) || blocklist.blocked[id]) continue;
  const v = vision[`${id}#0`];
  if (!v) continue; // jamais classée (ne devrait pas arriver) : laissée telle quelle, signalée par le test
  blocklist.blocked[id] = { reason: `vision : ${v.classe} (${Math.round(v.confiance * 100)} %)`, source: 'vision', at: TODAY };
  report.blocked.push(id);
}
// Écarte aussi les photos bloquées par erreur de l'ancienne heuristique mais dont aucune « plat » ne ressort : elles restent bloquées.

// Contrôle strict (planches « chk ») : une photo servie jugée non-plat au second passage est retirée.
for (const id of Object.keys(consented)) {
  const c = vision[`${id}#chk`];
  if (c && c.verdict === 'reject' && consented[id].kind !== 'dish' && !blocklist.blocked[id]) {
    blocklist.blocked[id] = { reason: `vision stricte : ${c.classe} (${Math.round(c.confiance * 100)} %)`, source: 'vision', at: TODAY };
    report.blocked.push(id);
  }
}

const servedIds = new Set(places.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r)).map(r => r.id));
const isServedPhoto = id => servedIds.has(id) && consented[id] && !blocklist.blocked[id];
const summary = {
  converted: report.converted.length, kept: report.kept.length, unblocked: report.unblocked.length, blocked: report.blocked.length,
  sharedDropped: report.sharedDropped.length, chain: report.chain.length,
  fichesServies: servedIds.size, fichesServiesAvecPhoto: [...servedIds].filter(isServedPhoto).length,
};
console.log(DRY ? '[dry-run]' : '', summary);
if (!DRY) {
  writeJson('data/photos-consented.json', Object.fromEntries(Object.entries(consented).sort(([a], [b]) => (a < b ? -1 : 1))));
  blocklist.blocked = Object.fromEntries(Object.entries(blocklist.blocked).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeJson('data/photo-blocklist.json', blocklist);
  writeJson('data/review/photo-selection.json', { summary, ...report });
}
