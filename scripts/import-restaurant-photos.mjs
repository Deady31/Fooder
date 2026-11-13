/**
 * Import des photos de restaurateurs consentants (voir docs/PHOTOS.md).
 *
 *   node scripts/import-restaurant-photos.mjs <fichier.csv|.json> [--apply] [--from-site] [--dir <dossier>]
 *
 * Par défaut : --dry-run (rien n'est écrit). --apply écrit :
 *   data/photo-consent.json, data/photos-consented.json, public/restos/<id>.<ext>
 * CSV (séparateur « ; ») : nom;fichier;type;date;moyen
 *   type  = plat | site          moyen = téléphone | whatsapp | email | autre
 *   date  = AAAA-MM-JJ           fichier = relatif à data/photos-restaurateurs/
 * Avec --from-site, une ligne sans fichier reprend la photo de public/restaurant-photos/<id>.jpg (type site).
 * Redimensionnement : sharp s'il est installé, sinon ffmpeg (JPEG 900 px q~78, EXIF supprimé).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CREDIT = 'Photo fournie par le restaurant';
const MAX_SIDE = 900;
const STOP = new Set(['chez', 'le', 'la', 'les', 'l', 'un', 'une', 'de', 'du', 'des', 'd', 'et', 'restaurant']);
const KINDS = { plat: 'dish', dish: 'dish', site: 'site' };
const SOURCES = {
  phone: 'phone', telephone: 'phone', tel: 'phone', whatsapp: 'whatsapp', wa: 'whatsapp',
  email: 'email', mail: 'email', courriel: 'email', other: 'other', autre: 'other',
};

const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Tokens significatifs d'un nom (sans accents, casse, ponctuation, « chez », articles). */
function tokens(name) {
  return fold(name).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !STOP.has(t));
}

export function normalizeName(name) {
  return tokens(name).join(' ');
}

/**
 * Rapproche un nom d'une liste de fiches { id, n, a }.
 * sure = un seul nom identique ; ambiguous = plusieurs identiques OU correspondance partielle (jamais écrite) ; missing = rien.
 */
export function matchName(name, places) {
  const key = normalizeName(name);
  if (!key) return { status: 'missing', candidates: [] };
  const byId = places.find(p => p.id === String(name).trim());
  if (byId) return { status: 'sure', candidates: [byId] };
  const exact = places.filter(p => normalizeName(p.n) === key);
  if (exact.length === 1) return { status: 'sure', candidates: exact };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };
  const q = tokens(name);
  const partial = places.filter(p => {
    const t = tokens(p.n);
    return t.length > 0 && (q.every(x => t.includes(x)) || t.every(x => q.includes(x)));
  });
  return { status: partial.length ? 'ambiguous' : 'missing', candidates: partial.slice(0, 8) };
}

/** Découpe une ligne CSV « ; » avec guillemets. */
function splitLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length && /^nom\s*;/i.test(lines[0])) lines.shift();
  return lines.map(l => {
    const [nom = '', fichier = '', type = '', date = '', moyen = '', note = ''] = splitLine(l);
    return { nom, fichier, type, date, moyen, ...(note ? { note } : {}) };
  });
}

/** Valide et normalise les lignes ; renvoie { rows, errors }. */
export function parseRows(raw) {
  const rows = [];
  const errors = [];
  raw.forEach((r, i) => {
    const label = `ligne ${i + 1} (${r?.nom ?? '?'})`;
    const kind = KINDS[fold(r?.type).trim()];
    const source = SOURCES[fold(r?.moyen).trim()];
    const date = String(r?.date ?? '').trim();
    if (!String(r?.nom ?? '').trim()) errors.push(`${label} : nom vide`);
    else if (!kind) errors.push(`${label} : type invalide « ${r.type} » (plat | site)`);
    else if (!source) errors.push(`${label} : moyen invalide « ${r.moyen} »`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.push(`${label} : date invalide « ${r.date} » (AAAA-MM-JJ)`);
    else rows.push({ nom: r.nom.trim(), fichier: String(r.fichier ?? '').trim(), kind, source, date, ...(r.note ? { note: String(r.note) } : {}) });
  });
  return { rows, errors };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

/** Redimensionne à 900 px, JPEG q~78, sans EXIF. */
async function resize(input, output) {
  try {
    const sharp = (await import('sharp')).default;
    await sharp(input).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(output);
    return;
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-vf', `scale='min(${MAX_SIDE},iw)':'min(${MAX_SIDE},ih)':force_original_aspect_ratio=decrease`, '-map_metadata', '-1', '-frames:v', '1', '-q:v', '4', output]);
  if (r.status !== 0) throw new Error(`ffmpeg a échoué : ${r.stderr?.toString() || r.error?.message || 'introuvable'}`);
}

function parseArgs(argv) {
  const args = { apply: false, fromSite: false, dir: path.join(ROOT, 'data', 'photos-restaurateurs'), input: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--from-site') args.fromSite = true;
    else if (a === '--dir') args.dir = path.resolve(argv[++i]);
    else if (!a.startsWith('--')) args.input = a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage : node scripts/import-restaurant-photos.mjs <fichier.csv|.json> [--apply] [--from-site] [--dir <dossier>]');
    process.exit(1);
  }
  const text = await fs.readFile(args.input, 'utf8');
  const raw = args.input.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
  const { rows, errors } = parseRows(Array.isArray(raw) ? raw : []);
  const places = await readJson(path.join(ROOT, 'data', 'toulouse-places.json'), []);

  const plan = [];
  let blocked = errors.length;
  errors.forEach(e => console.log(`ERREUR     ${e}`));
  for (const row of rows) {
    const m = matchName(row.nom, places);
    const fromSite = !row.fichier;
    if (m.status === 'sure') {
      const place = m.candidates[0];
      const srcFile = fromSite ? path.join(ROOT, 'public', 'restaurant-photos', `${place.id}.jpg`) : path.resolve(args.dir, row.fichier);
      const inside = fromSite || srcFile.startsWith(path.resolve(args.dir) + path.sep);
      const exists = inside && await fs.access(srcFile).then(() => true, () => false);
      if (fromSite && !args.fromSite) { console.log(`ERREUR     « ${row.nom} » : fichier vide (utilise --from-site pour la photo du site)`); blocked++; continue; }
      if (!exists) { console.log(`ERREUR     « ${row.nom} » : fichier introuvable ${srcFile}`); blocked++; continue; }
      console.log(`SÛR        « ${row.nom} » -> ${place.id} ${place.n} (${place.a || 'sans adresse'}) [${fromSite ? 'site' : row.kind}]`);
      plan.push({ row, place, srcFile, kind: fromSite ? 'site' : row.kind });
    } else if (m.status === 'ambiguous') {
      console.log(`AMBIGU     « ${row.nom} » : précise l'id OSM dans la colonne nom. Candidats :`);
      m.candidates.forEach(c => console.log(`             - ${c.id}  ${c.n}  (${c.a || 'sans adresse'})`));
      blocked++;
    } else {
      console.log(`INTROUVABLE « ${row.nom} »`);
      blocked++;
    }
  }

  if (!args.apply) {
    console.log(`\n[dry-run] ${plan.length} importable(s), ${blocked} à corriger. Rien n'a été écrit. Ajoute --apply pour écrire.`);
    return;
  }
  if (blocked > 0) {
    console.error(`\nAnnulé : ${blocked} ligne(s) ambiguë(s), introuvable(s) ou invalide(s). Rien n'a été écrit.`);
    process.exit(2);
  }

  const consentFile = path.join(ROOT, 'data', 'photo-consent.json');
  const photosFile = path.join(ROOT, 'data', 'photos-consented.json');
  const consent = await readJson(consentFile, { version: 1, restaurants: {} });
  const photos = await readJson(photosFile, {});
  await fs.mkdir(path.join(ROOT, 'public', 'restos'), { recursive: true });
  const nextConsent = { ...consent, restaurants: { ...consent.restaurants } };
  const nextPhotos = { ...photos };
  for (const { row, place, srcFile, kind } of plan) {
    const consentedAt = new Date(`${row.date}T12:00:00Z`).toISOString();
    // Une photo de plat n'est jamais écrasée par une photo de site.
    if (!(kind === 'site' && nextPhotos[place.id]?.kind === 'dish')) {
      await resize(srcFile, path.join(ROOT, 'public', 'restos', `${place.id}.jpg`));
      nextPhotos[place.id] = { src: `/restos/${place.id}.jpg`, kind, credit: CREDIT, consentedAt };
    }
    nextConsent.restaurants[place.id] = { name: place.n, consentedAt, source: row.source, ...(row.note ? { note: row.note } : {}) };
  }
  await fs.writeFile(consentFile, JSON.stringify(nextConsent, null, 2) + '\n');
  await fs.writeFile(photosFile, JSON.stringify(nextPhotos, null, 2) + '\n');
  console.log(`\n${plan.length} photo(s) importée(s) dans public/restos/ ; consentement et table mis à jour.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
