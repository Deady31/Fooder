// Extrait les lieux de restauration d'une ville depuis OpenStreetMap (Overpass) vers data/<ville>-places.json,
// au même format que data/toulouse-places.json (champs id, n, k, c, la, ln, a, h, w, t, d, s, dt).
//
// Usage :
//   node scripts/extract-city.mjs --city bordeaux --bbox 44.79,-0.66,44.92,-0.52
//   node scripts/extract-city.mjs --city "Albi" --area            (commune entière, par son nom OSM, admin_level 8)
//   node scripts/extract-city.mjs --city bordeaux --bbox ... --dry-run   (affiche la requête, n'appelle rien)
// Options : --out <fichier> · --force (écraser) · --endpoint <url> · --kinds restaurant,fast_food,...
//
// Politique Overpass respectée (https://wiki.openstreetmap.org/wiki/Overpass_API) :
// UNE requête par exécution (deux tentatives au plus, jamais en parallèle), User-Agent explicite,
// pause de 30 s après un 429/504 avant la seconde tentative, zone plafonnée.
// Mettre un contact dans FOODER_CONTACT (ex. une adresse de projet) pour l'ajouter au User-Agent.
// Données © contributeurs OpenStreetMap, licence ODbL : créditer OSM dans l'appli.
//
// Ce script ne fait QUE la partie OSM. Pour Toulouse, le fichier final fusionne aussi Overture Maps
// (scripts/import-overture.py puis scripts/build-places.mjs) : voir docs/EXPANSION_VILLE.md.
import { writeFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const FALLBACK_ENDPOINT = 'https://lz4.overpass-api.de/api/interpreter';
export const DEFAULT_KINDS = ['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream'];
const ALLOWED_KINDS = new Set(DEFAULT_KINDS);
const DIETS = ['vegan', 'vegetarian', 'halal', 'gluten_free'];
// Toulouse Métropole fait ~0,25° x 0,36° : on refuse au-delà de 0,6° x 0,6° (requête trop lourde pour l'instance publique).
const MAX_SPAN_DEG = 0.6;
const RETRY_WAIT_MS = 30_000;
const PROTECTED = /(^|[\\/])toulouse-places\.json$/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** « Saint-Étienne » -> « saint-etienne » (nom de fichier sûr). */
export function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** "sud,ouest,nord,est" (ordre Overpass) -> objet validé, ou exception explicite. */
export function parseBbox(raw) {
  const parts = String(raw ?? '').split(',').map(s => Number(s.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    throw new Error('--bbox attendu : sud,ouest,nord,est (ex. 44.79,-0.66,44.92,-0.52)');
  }
  const [s, w, n, e] = parts;
  if (s < -90 || n > 90 || w < -180 || e > 180 || s >= n || w >= e) throw new Error('--bbox incohérente (sud < nord, ouest < est)');
  if (n - s > MAX_SPAN_DEG || e - w > MAX_SPAN_DEG) {
    throw new Error(`--bbox trop grande (max ${MAX_SPAN_DEG}° de côté) : découper la zone, l'instance publique Overpass n'est pas faite pour ça`);
  }
  return { s, w, n, e };
}

export function parseArgs(argv) {
  const opts = { city: '', bbox: null, area: false, out: '', force: false, dryRun: false, endpoint: DEFAULT_ENDPOINT, kinds: DEFAULT_KINDS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`valeur manquante après ${a}`);
      return v;
    };
    if (a === '--city') opts.city = next().trim();
    else if (a === '--bbox') opts.bbox = parseBbox(next());
    else if (a === '--area') opts.area = true;
    else if (a === '--out') opts.out = next();
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--endpoint') opts.endpoint = next();
    else if (a === '--kinds') opts.kinds = next().split(',').map(s => s.trim()).filter(Boolean);
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!opts.city || !slugify(opts.city)) throw new Error('--city obligatoire (nom de la ville)');
  if (!opts.bbox && !opts.area) throw new Error('donner --bbox sud,ouest,nord,est ou --area (commune entière)');
  if (opts.bbox && opts.area) throw new Error('--bbox et --area sont exclusifs');
  if (opts.kinds.length === 0 || opts.kinds.some(k => !ALLOWED_KINDS.has(k))) {
    throw new Error(`--kinds parmi : ${DEFAULT_KINDS.join(', ')}`);
  }
  if (!/^https:\/\/[^\s]+\/api\/interpreter$/.test(opts.endpoint)) throw new Error('--endpoint doit être une URL https se terminant par /api/interpreter');
  opts.out = opts.out || `data/${slugify(opts.city)}-places.json`;
  if (PROTECTED.test(opts.out)) throw new Error('refus : data/toulouse-places.json n\'est jamais écrasé par ce script');
  return opts;
}

/** Échappe une valeur pour une chaîne Overpass QL entre guillemets. */
const qlString = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Une seule requête : tous les lieux nommés des types voulus, centre + tags. */
export function buildQuery(opts) {
  const kinds = opts.kinds.join('|');
  const filter = `["amenity"~"^(${kinds})$"]["name"]`;
  if (opts.bbox) {
    const { s, w, n, e } = opts.bbox;
    return `[out:json][timeout:180][bbox:${s},${w},${n},${e}];\nnwr${filter};\nout center tags;`;
  }
  return `[out:json][timeout:180];\narea["boundary"="administrative"]["admin_level"="8"]["name"="${qlString(opts.city)}"]->.zone;\nnwr${filter}(area.zone);\nout center tags;`;
}

const yes = v => v === 'yes' || v === 'only';

/** Régimes déclarés (mêmes règles que scripts/extract-osm-diets.mjs : aucune déduction, vegan => vegetarian). */
export function dietsFromTags(tags, name = '') {
  const set = new Set();
  for (const d of DIETS) if (yes(tags[`diet:${d}`])) set.add(d);
  for (const c of (tags.cuisine ?? '').toLowerCase().split(/[;,]/).map(s => s.trim())) {
    if (c === 'vegan' || c === 'vegetarian' || c === 'halal') set.add(c);
  }
  if (/\bhalal\b/i.test(name)) set.add('halal');
  if (set.has('vegan')) set.add('vegetarian');
  return DIETS.filter(d => set.has(d));
}

/** Élément Overpass -> fiche au format de data/toulouse-places.json (null si inutilisable). */
export function elementToRecord(el) {
  const t = el?.tags ?? {};
  const lat = el?.lat ?? el?.center?.lat;
  const lng = el?.lon ?? el?.center?.lon;
  if (!t.name || typeof lat !== 'number' || typeof lng !== 'number' || !el.type || el.id == null) return null;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const dt = dietsFromTags(t, t.name);
  return {
    id: `osm-${el.type[0]}${el.id}`,
    n: t.name,
    k: t.amenity,
    c: t.cuisine ?? '',
    la: Math.round(lat * 1e6) / 1e6,
    ln: Math.round(lng * 1e6) / 1e6,
    a: [street, t['addr:postcode'], t['addr:city']].filter(Boolean).join(', '),
    h: t.opening_hours ?? '',
    w: t.website ?? t['contact:website'] ?? '',
    t: t.phone ?? t['contact:phone'] ?? '',
    d: dt.includes('vegetarian') ? 1 : 0,
    s: 'o',
    ...(dt.length ? { dt } : {}),
  };
}

export function toRecords(json) {
  const seen = new Set();
  const out = [];
  for (const el of json?.elements ?? []) {
    const rec = elementToRecord(el);
    if (!rec || seen.has(rec.id)) continue;
    seen.add(rec.id);
    out.push(rec);
  }
  return out;
}

function userAgent() {
  const contact = (process.env.FOODER_CONTACT ?? '').replace(/[^\w@.+:/ -]/g, '').slice(0, 80);
  return `fooder-extract-city/1.0 (one-off city extraction, 1 request${contact ? `; contact: ${contact}` : ''})`;
}

/** Au plus deux tentatives, séquentielles ; 30 s d'attente après 429/504 (politique Overpass). */
async function fetchOverpass(query, endpoint) {
  const targets = endpoint === DEFAULT_ENDPOINT ? [DEFAULT_ENDPOINT, FALLBACK_ENDPOINT] : [endpoint, endpoint];
  let lastError = '';
  for (let attempt = 0; attempt < targets.length; attempt++) {
    if (attempt > 0) {
      console.warn(`Pause de ${RETRY_WAIT_MS / 1000} s avant la seconde tentative…`);
      await sleep(RETRY_WAIT_MS);
    }
    try {
      const res = await fetch(targets[attempt], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent() },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(200_000),
      });
      if (res.ok) return await res.json();
      lastError = `${targets[attempt]} -> HTTP ${res.status}`;
      // Erreurs non temporaires : inutile de réessayer
      if (res.status === 400) break;
    } catch (e) {
      lastError = `${targets[attempt]} -> ${e instanceof Error ? e.message : String(e)}`;
    }
    console.warn(lastError);
  }
  throw new Error(`Overpass indisponible (${lastError}). Réessayer plus tard, pas en boucle.`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function main(argv) {
  const opts = parseArgs(argv);
  const query = buildQuery(opts);
  if (opts.dryRun) {
    console.log(`Sortie prévue : ${opts.out}\nUser-Agent : ${userAgent()}\nRequête :\n${query}`);
    return;
  }
  if (!opts.force && (await exists(opts.out))) throw new Error(`${opts.out} existe déjà (ajouter --force pour l'écraser)`);

  const started = Date.now();
  const json = await fetchOverpass(query, opts.endpoint);
  if (json?.remark) console.warn(`Remarque Overpass : ${String(json.remark).slice(0, 200)}`);
  const records = toRecords(json);
  if (records.length === 0) {
    throw new Error('0 lieu trouvé : vérifier la bbox (sud,ouest,nord,est) ou le nom exact de la commune dans OSM. Aucun fichier écrit.');
  }
  await writeFile(opts.out, JSON.stringify(records));

  const by = k => records.filter(r => r.k === k).length;
  const pct = n => `${Math.round((n / records.length) * 100)} %`;
  const withCuisine = records.filter(r => r.c).length;
  const withHours = records.filter(r => r.h).length;
  console.log(`${records.length} lieux écrits dans ${opts.out} (${json.elements?.length ?? 0} éléments Overpass, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
  console.log(`Types : ${DEFAULT_KINDS.map(k => `${k} ${by(k)}`).join(' · ')}`);
  console.log(`Qualité : cuisine ${pct(withCuisine)} · horaires ${pct(withHours)} · régimes ${pct(records.filter(r => r.dt).length)}`);
  console.log('Rappel : seules les fiches « présentables » (cuisine + horaires lisibles, lib/osm.ts) apparaissent dans le deck.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(e => {
    console.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
