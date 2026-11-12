// Ajoute le champ `dt` (régimes déclarés) aux fiches de data/toulouse-places.json, depuis les tags OpenStreetMap.
// Usage: node scripts/extract-osm-diets.mjs   (une seule requête Overpass ; données © contributeurs OpenStreetMap, ODbL)
// Règles : seules les valeurs 'yes' / 'only' comptent. Cuisine vegan/vegetarian/halal et nom contenant « halal » comptent aussi.
// Aucune déduction (kebab/oriental != halal). vegan implique vegetarian.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'data/toulouse-places.json';
const UA = 'fooder-diets-extract/1.0 (dataset enrichment, 1 request)';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const DIETS = ['vegan', 'vegetarian', 'halal', 'gluten_free'];
const AM = '^(restaurant|fast_food|cafe|bar)$';
const QUERY = `[out:json][timeout:180][bbox:43.48,1.28,43.73,1.64];
(
  nwr["amenity"~"${AM}"]["diet:vegan"~"^(yes|only)$"];
  nwr["amenity"~"${AM}"]["diet:vegetarian"~"^(yes|only)$"];
  nwr["amenity"~"${AM}"]["diet:halal"~"^(yes|only)$"];
  nwr["amenity"~"${AM}"]["diet:gluten_free"~"^(yes|only)$"];
  nwr["amenity"~"${AM}"]["cuisine"~"(^|;)\\s*(vegan|vegetarian|halal)\\s*(;|$)"];
);
out tags;`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let requests = 0;

async function fetchOverpass() {
  for (let round = 0; round < 3; round++) for (const url of ENDPOINTS) {
    try {
      requests++;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(QUERY),
      });
      if (res.ok) return await res.json();
      console.warn(url, res.status);
      await sleep(res.status === 429 || res.status === 504 ? 15000 : 5000);
    } catch (e) {
      console.warn(url, e.message);
      await sleep(5000);
    }
  }
  throw new Error('Overpass indisponible');
}

const yes = v => v === 'yes' || v === 'only';

/** Régimes déclarés par un jeu de tags OSM (ordre canonique, vegan => vegetarian). */
export function dietsFromTags(tags) {
  const set = new Set();
  if (yes(tags['diet:vegan'])) set.add('vegan');
  if (yes(tags['diet:vegetarian'])) set.add('vegetarian');
  if (yes(tags['diet:halal'])) set.add('halal');
  if (yes(tags['diet:gluten_free'])) set.add('gluten_free');
  for (const c of (tags.cuisine ?? '').toLowerCase().split(/[;,]/).map(s => s.trim())) {
    if (c === 'vegan' || c === 'vegetarian' || c === 'halal') set.add(c);
  }
  return set;
}

const finish = set => {
  if (set.has('vegan')) set.add('vegetarian');
  return DIETS.filter(d => set.has(d));
};

const json = await fetchOverpass();
const byId = new Map();
for (const el of json.elements) byId.set(`osm-${el.type[0]}${el.id}`, dietsFromTags(el.tags ?? {}));

const places = JSON.parse(await readFile(FILE, 'utf8'));
const counts = Object.fromEntries(DIETS.map(d => [d, 0]));
const out = places.map(({ dt: _old, ...rec }) => {
  const set = new Set(byId.get(rec.id) ?? []);
  for (const c of (rec.c ?? '').toLowerCase().split(/[;,]/).map(s => s.trim())) {
    if (c === 'vegan' || c === 'vegetarian' || c === 'halal') set.add(c);
  }
  if (/\bhalal\b/i.test(rec.n)) set.add('halal');
  const dt = finish(set);
  if (!dt.length) return rec;
  dt.forEach(d => counts[d]++);
  return { ...rec, dt };
});

await writeFile(FILE, JSON.stringify(out));
console.log(`Requêtes Overpass : ${requests}; éléments Overpass : ${json.elements.length}`);
console.log(`Fiches avec dt : ${out.filter(r => r.dt).length} / ${out.length}`, counts);
