/**
 * Écarte toute photo qui n'est pas propre à UN établissement : même image (octets identiques) ou même page source
 * rattachée à plusieurs fiches (visuel de marque, d'hébergeur, d'une chaîne). Règle produit : une image ne s'affiche
 * que sur la fiche de l'établissement exact. Idempotent : ne touche que les entrées `source: "auto-shared"`.
 *   node scripts/flag-shared-photos.mjs            applique (data/photo-blocklist.json)
 *   node scripts/flag-shared-photos.mjs --dry-run  compte seulement
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry-run');
const readJson = async (f) => JSON.parse((await fs.readFile(path.join(ROOT, f), 'utf8')).replace(/^﻿/, ''));

const photos = await readJson('data/photos-consented.json');
const blocklist = await readJson('data/photo-blocklist.json');
blocklist.version ??= 1;
blocklist.blocked ??= {};

const byHash = new Map();
const byPage = new Map();
const normPage = (u) => String(u || '').toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '');
for (const [id, p] of Object.entries(photos)) {
  if (!p?.src) continue;
  const file = path.join(ROOT, 'public', p.src);
  const buf = await fs.readFile(file).catch(() => null);
  if (buf) {
    const h = crypto.createHash('md5').update(buf).digest('hex');
    byHash.set(h, [...(byHash.get(h) ?? []), id]);
  }
  const page = normPage(p.page);
  if (page) byPage.set(page, [...(byPage.get(page) ?? []), id]);
}

const shared = new Map(); // id -> raison
for (const ids of byHash.values()) if (ids.length > 1) for (const id of ids) shared.set(id, `image identique sur ${ids.length} fiches (visuel de marque ou d'hébergeur)`);
for (const [page, ids] of byPage) if (ids.length > 1) for (const id of ids) if (!shared.has(id)) shared.set(id, `même page source pour ${ids.length} fiches (${page.slice(0, 80)})`);

// Retire d'abord les anciennes entrées auto-shared, puis réapplique : le résultat reflète toujours les données actuelles.
for (const [id, e] of Object.entries(blocklist.blocked)) if (e?.source === 'auto-shared') delete blocklist.blocked[id];
const today = new Date().toISOString().slice(0, 10);
let added = 0;
for (const [id, reason] of shared) {
  if (blocklist.blocked[id]) continue; // déjà écartée pour une autre raison
  blocklist.blocked[id] = { reason, source: 'auto-shared', at: today };
  added++;
}
console.log(`photos du manifeste : ${Object.keys(photos).length} | fiches à image partagée : ${shared.size} | nouvelles entrées : ${added}`);
if (!dry) await fs.writeFile(path.join(ROOT, 'data/photo-blocklist.json'), JSON.stringify(blocklist, null, 1) + '\n');
