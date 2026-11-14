#!/usr/bin/env node
/**
 * Retire vite une mauvaise photo ou un restaurant.
 *   node scripts/block-photo.mjs <id> [raison]            photo écartée pour qualité (data/photo-blocklist.json)
 *   node scripts/block-photo.mjs <id> --revoke            le restaurant retire son accord (data/photo-consent.json > revoked)
 *   node scripts/block-photo.mjs <id> --undo [--revoke]   annule l'une ou l'autre
 * Effet dès le prochain déploiement ; aucun fichier image n'est supprimé.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const [id, ...rest] = argv.filter((a) => !a.startsWith('--'));
const revoke = flags.includes('--revoke');
const undo = flags.includes('--undo');
const reason = rest.join(' ') || 'manuel';

if (!id || !/^osm-[a-z]\d+$/i.test(id)) {
  console.error('Usage : node scripts/block-photo.mjs <id OSM, ex. osm-n250665866> [raison] [--revoke] [--undo]');
  process.exit(1);
}

const file = path.join(ROOT, 'data', revoke ? 'photo-consent.json' : 'photo-blocklist.json');
const raw = await fs.readFile(file, 'utf8').catch(() => '{}');
const data = JSON.parse(raw.replace(/^﻿/, '') || '{}');
const today = new Date().toISOString().slice(0, 10);

if (revoke) {
  const set = new Set(data.revoked ?? []);
  if (undo) set.delete(id);
  else set.add(id);
  data.revoked = [...set].sort();
} else {
  data.version ??= 1;
  data.blocked ??= {};
  if (undo) delete data.blocked[id];
  else data.blocked[id] = { reason, source: 'manual', at: today };
}

await fs.writeFile(file, JSON.stringify(data, null, 1) + '\n');
const what = revoke ? (undo ? 'accord rétabli' : 'accord retiré') : undo ? 'photo débloquée' : `photo écartée (${reason})`;
console.log(`${id} : ${what} -> ${path.relative(ROOT, file)}`);
