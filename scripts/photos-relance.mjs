// Étape 4 : liste des restaurateurs à relancer = fiches servies sans photo de plat valable.
//   node scripts/photos-relance.mjs  →  data/review/relance-restaurateurs.csv (séparateur « ; », UTF-8 avec BOM, ouvrable dans Excel)
// Colonnes : id ; nom ; téléphone ; adresse vérifiée ; raison (pourquoi la photo manque). Les numéros viennent de la
// base OSM/Overture (déjà publique) ; le fichier reste local (data/review/ est ignoré par git).
import fs from 'node:fs';
import { loadTs } from './lib/loadTs.mjs';

const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const { isPresentable } = await loadTs('lib/osm.ts');
const places = readJson('data/toulouse-places.json', []);
const table = readJson('data/photos-consented.json', {});
const blocked = readJson('data/photo-blocklist.json', {}).blocked ?? {};
const addr = readJson('data/addresses-verified.json', {});
const cands = readJson('data/cache/photo-candidates.json', {});
const vision = readJson('data/photo-vision.json', {});
const NOT_A_SITE = /(facebook|instagram|linktr\.ee|lafourchette|thefork|tripadvisor|ubereats|deliveroo|just-eat|google\.|goo\.gl)/i;

function reason(r) {
  if (!r.w) return 'pas de site';
  if (NOT_A_SITE.test(r.w)) return 'site = réseau social ou agrégateur';
  const c = cands[r.id];
  if (!c) return 'site non exploré';
  if (c.error === 'ENOTFOUND' || c.error === 'EAI_AGAIN') return 'site inaccessible (domaine mort)';
  if (c.error === 'robots') return 'site : robots.txt interdit';
  if (/^http-/.test(c.error)) return `site en erreur (${c.error.replace('http-', 'HTTP ')})`;
  if (c.error) return 'site injoignable (délai, certificat ou connexion)';
  if (!c.cands.length) return 'site sans image exploitable';
  const mine = Object.entries(vision).filter(([k]) => k.startsWith(`${r.id}#`));
  return mine.length ? 'images du site : aucune photo de plat nette' : 'images du site écartées (taille, doublon ou logo)';
}

const rows = places
  .filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r) && !(table[r.id] && !blocked[r.id]))
  .map(r => ({ id: r.id, nom: r.n, tel: r.t ?? '', adresse: addr[r.id]?.a ?? '', raison: reason(r) }))
  .sort((a, b) => (a.tel ? 0 : 1) - (b.tel ? 0 : 1) || (a.nom < b.nom ? -1 : 1));
const q = s => `"${String(s).replace(/"/g, '""')}"`;
const csv = '\uFEFF' + ['id;nom;telephone;adresse;raison', ...rows.map(r => [r.id, q(r.nom), q(r.tel), q(r.adresse), q(r.raison)].join(';'))].join('\r\n') + '\r\n';
fs.writeFileSync('data/review/relance-restaurateurs.csv', csv);
const byReason = {};
for (const r of rows) byReason[r.raison] = (byReason[r.raison] ?? 0) + 1;
console.log(`${rows.length} fiches à relancer, dont ${rows.filter(r => r.tel).length} avec téléphone`, byReason);
