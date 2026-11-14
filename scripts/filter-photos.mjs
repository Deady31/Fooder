#!/usr/bin/env node
/**
 * Rapport des images qui ne sont probablement pas des plats (heuristiques de scripts/photo-quality.mjs :
 * ratio extrême, peu de couleurs, aplat, poids faible, nom de fichier logo/banner/menu/façade...).
 * Par défaut : rapport seul. --apply écrit les rejetées dans data/photo-blocklist.json (aucun fichier déplacé/supprimé).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualityReasons } from './photo-quality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const read = async (p) => (await fs.readFile(p, 'utf8')).replace(/^\uFEFF/, '');

const manifest = JSON.parse(await read(path.join(ROOT, 'data', 'restaurant-photos.json')));
const inManifest = new Set(manifest.map((e) => e.id));
const stats = JSON.parse(await read(path.join(ROOT, 'data', 'photo-stats.json'))).filter((s) => inManifest.has(s.id));
const names = new Map(manifest.map((e) => [e.id, e.name]));

const entries = new Map(manifest.map((e) => [e.id, e]));
const reasons = (s) => qualityReasons(s, entries.get(s.id));

const rejected = stats.filter((s) => reasons(s).length > 0);
const byReason = {};
for (const s of rejected) for (const r of reasons(s)) byReason[r] = (byReason[r] ?? 0) + 1;

console.log(`${stats.length} photos · ${rejected.length} rejetées (${((rejected.length / stats.length) * 100).toFixed(1)} %)`);
console.log(byReason);
for (const reason of Object.keys(byReason)) {
  const ex = rejected.filter((s) => reasons(s).includes(reason)).slice(0, 6);
  console.log(`  ${reason} :`, ex.map((s) => `${names.get(s.id) ?? s.id} [${s.colors}c ${s.top}t ${s.ratio}r]`).join(' · '));
}

if (apply) {
  const file = path.join(ROOT, 'data', 'photo-blocklist.json');
  const bl = JSON.parse((await fs.readFile(file, 'utf8').catch(() => '{}')).replace(/^﻿/, '') || '{}');
  bl.version ??= 1;
  bl.blocked ??= {};
  for (const s of rejected) bl.blocked[s.id] ??= { reason: reasons(s).join(', '), source: 'auto', at: new Date().toISOString().slice(0, 10) };
  await fs.writeFile(file, JSON.stringify(bl, null, 1) + '\n');
  console.log(`${Object.keys(bl.blocked).length} photos dans data/photo-blocklist.json`);
}
