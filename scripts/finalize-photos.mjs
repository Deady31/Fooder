#!/usr/bin/env node
/**
 * Construit data/photos-local.json : la table id OSM -> photo servie par l'app.
 * Ne garde que les photos réellement converties dans public/restaurant-photos.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'restaurant-photos.json'), 'utf8'));
const outDir = path.join(ROOT, 'public', 'restaurant-photos');

const table = {};
let missing = 0;
for (const e of manifest) {
  try {
    await fs.access(path.join(outDir, `${e.id}.jpg`));
  } catch {
    missing += 1;
    continue;
  }
  let host = '';
  try {
    host = new URL(e.page).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }
  table[e.id] = { src: `/restaurant-photos/${e.id}.jpg`, credit: host, page: e.page };
}

await fs.writeFile(path.join(ROOT, 'data', 'photos-local.json'), JSON.stringify(table, null, 0));
console.log(`${Object.keys(table).length} photos prêtes · ${missing} manquantes (non converties)`);

const byKind = {};
for (const e of manifest) if (table[e.id]) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
console.log('par type :', byKind);
