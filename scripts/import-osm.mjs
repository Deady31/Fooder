// Importe les restaurants de Toulouse depuis OpenStreetMap (Overpass) vers data/raw/osm.json (puis `npm run build:places`).
// Usage: node scripts/import-osm.mjs   (données © contributeurs OpenStreetMap, licence ODbL)
import { writeFile, mkdir } from 'node:fs/promises';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// Boîte englobante de Toulouse Métropole (plus légère pour Overpass qu'une recherche par zone administrative)
const QUERY = `[out:json][timeout:120][bbox:43.48,1.28,43.73,1.64];
nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream)$"];
out center tags;`;

async function fetchOverpass() {
  for (let round = 0; round < 3; round++) for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'fooder-import/1.0' },
        body: 'data=' + encodeURIComponent(QUERY),
      });
      if (res.ok) return await res.json();
      console.warn(url, res.status);
      await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      console.warn(url, e.message);
    }
  }
  throw new Error('Overpass indisponible');
}

const json = await fetchOverpass();
const out = [];
for (const el of json.elements) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lng == null) continue;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  out.push({
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
    d: t.diet_vegetarian === 'yes' || t['diet:vegetarian'] === 'yes' ? 1 : 0,
  });
}
await mkdir('data/raw', { recursive: true });
await writeFile('data/raw/osm.json', JSON.stringify(out));
console.log(`${out.length} lieux écrits (sur ${json.elements.length} éléments)`);
