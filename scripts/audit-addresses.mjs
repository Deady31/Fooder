#!/usr/bin/env node
/**
 * Audit des adresses des fiches présentables (restaurant et fast_food). LECTURE SEULE : aucun appel réseau, aucun fichier du dépôt modifié.
 * Écrit data/review/audit-adresses.json (hors git) et affiche un résumé court.
 *
 * Usage : node scripts/audit-addresses.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './lib/loadTs.mjs';
import { addressIssues, clusterByName, coherence, sameVenue } from './lib/addressAudit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async rel => JSON.parse((await fs.readFile(path.join(ROOT, rel), 'utf8')).replace(/^﻿/, ''));
const count = (list, pred) => list.filter(pred).length;

const { isPresentable } = await loadTs('lib/osm.ts');
const places = await read('data/toulouse-places.json');
const osmRaw = new Map((await read('data/raw/osm.json')).map(r => [r.id, r.a ?? '']));
const ovtRaw = await read('data/raw/overture.json');

// Grille des lieux Overture pour retrouver le « jumeau » d'une fiche fusionnée (mêmes règles que build-places : même nom, moins de 70 m).
const cell = r => `${Math.floor(r.la * 1000)}:${Math.floor(r.ln * 1000)}`;
const grid = new Map();
for (const v of ovtRaw) {
  const c = cell(v);
  if (!grid.has(c)) grid.set(c, []);
  grid.get(c).push(v);
}
const twinsOf = r => {
  const cy = Math.floor(r.la * 1000);
  const cx = Math.floor(r.ln * 1000);
  const found = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) found.push(...(grid.get(`${cy + dy}:${cx + dx}`) ?? []));
  return found.filter(v => sameVenue(r, v));
};

const presentable = places.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r));
const { duplicates, chains } = clusterByName(presentable, 50);
const dupOf = new Map();
duplicates.forEach((d, i) => d.ids.forEach(id => dupOf.set(id, i)));
const chainOf = new Set(chains.flatMap(c => c.ids));

const records = [];
const cohCounts = { ok: 0, incomplet: 0, conflit_numero: 0, conflit_code_postal: 0, sans_jumeau: 0 };
for (const r of presentable) {
  const issues = addressIssues(r.a);
  let coh = null;
  if (r.s === 'b') {
    const twin = twinsOf(r)[0];
    coh = twin ? coherence(osmRaw.get(r.id), twin.a) : 'sans_jumeau';
    cohCounts[coh] += 1;
  }
  const flagged = issues.length > 0 || (coh && coh.startsWith('conflit')) || dupOf.has(r.id);
  if (flagged) records.push({ id: r.id, n: r.n, k: r.k, s: r.s, a: r.a || null, issues, coherence: coh, dupCluster: dupOf.get(r.id) ?? null, chain: chainOf.has(r.id) });
}

const noAddr = presentable.filter(r => !r.a);
const summary = {
  presentables: presentable.length,
  parSource: { osm: count(presentable, r => r.s === 'o'), overture: count(presentable, r => r.s === 'v'), fusionnees: count(presentable, r => r.s === 'b') },
  sansAdresse: noAddr.length,
  sansAdresseParSource: { osm: count(noAddr, r => r.s === 'o'), overture: count(noAddr, r => r.s === 'v'), fusionnees: count(noAddr, r => r.s === 'b') },
  avecAdresseSansNumero: count(presentable, r => r.a && addressIssues(r.a).includes('sans_numero')),
  sansCodePostal: count(presentable, r => r.a && addressIssues(r.a).includes('sans_code_postal')),
  sansCommune: count(presentable, r => r.a && addressIssues(r.a).includes('sans_commune')),
  adresseComplete: count(presentable, r => addressIssues(r.a).length === 0),
  coherenceOsmOverture: cohCounts,
  doublonsA50m: { groupes: duplicates.length, fiches: dupOf.size },
  chaines: { noms: chains.length, fiches: chainOf.size },
};

const wanted = presentable.filter(r => /tasty crousty|crousty one/i.test(r.n));
const witness = [...places.filter(r => /tasty crousty|crousty one/i.test(r.n))].map(r => ({ id: r.id, n: r.n, a: r.a || null, la: r.la, ln: r.ln, presentable: wanted.some(x => x.id === r.id) }));

await fs.mkdir(path.join(ROOT, 'data', 'review'), { recursive: true });
await fs.writeFile(
  path.join(ROOT, 'data', 'review', 'audit-adresses.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), summary, temoins: witness, chaines: chains.sort((a, b) => b.agencies - a.agencies).slice(0, 40), doublons: duplicates, fiches: records }, null, 1)
);

const pct = n => `${((n / presentable.length) * 100).toFixed(1)} %`;
console.log(`1. Fiches présentables (restaurant + fast_food) : ${summary.presentables} (OSM ${summary.parSource.osm}, Overture ${summary.parSource.overture}, fusionnées ${summary.parSource.fusionnees})`);
console.log(`2. Sans aucune adresse : ${summary.sansAdresse} (${pct(summary.sansAdresse)}) : OSM ${summary.sansAdresseParSource.osm}, Overture ${summary.sansAdresseParSource.overture}, fusionnées ${summary.sansAdresseParSource.fusionnees}`);
console.log(`3. Avec adresse mais sans numéro de rue : ${summary.avecAdresseSansNumero}`);
console.log(`4. Adresse sans code postal : ${summary.sansCodePostal} · sans commune : ${summary.sansCommune}`);
console.log(`5. Adresse complète (numéro + code postal + commune) : ${summary.adresseComplete} (${pct(summary.adresseComplete)})`);
console.log(`6. Cohérence OSM/Overture (fiches fusionnées) : ok ${cohCounts.ok}, incomplet ${cohCounts.incomplet}, conflit de numéro ${cohCounts.conflit_numero}, conflit de code postal ${cohCounts.conflit_code_postal}, sans jumeau retrouvé ${cohCounts.sans_jumeau}`);
console.log(`7. Doublons à 50 m ou moins : ${summary.doublonsA50m.groupes} groupes, ${summary.doublonsA50m.fiches} fiches à fusionner`);
console.log(`8. Chaînes (même nom, agences distinctes) : ${summary.chaines.noms} noms, ${summary.chaines.fiches} fiches`);
for (const w of witness) console.log(`9. Témoin ${w.n} ${w.id} : ${w.a ?? 'SANS ADRESSE'} (${w.la.toFixed(4)}, ${w.ln.toFixed(4)}) ${w.presentable ? 'présentable' : 'non présentable'}`);
console.log(`10. Détail : data/review/audit-adresses.json (${records.length} fiches signalées, hors git)`);
