// Fusionne OpenStreetMap (horaires, cuisine) et Overture Maps (adresses, téléphones, sites) en data/toulouse-places.json.
// Usage : npm run import:osm && npm run import:overture && npm run build:places
import { readFile, writeFile } from 'node:fs/promises';

const osm = JSON.parse(await readFile('data/raw/osm.json', 'utf8'));
const ovt = JSON.parse(await readFile('data/raw/overture.json', 'utf8'));

// ── Classement des catégories Overture ────────────────────────────────────────
const SKIP = new Set(['bakery', 'chocolatier', 'delicatessen', 'dessert_shop', 'candy_store', 'patisserie_and_cake_shop', 'butcher_shop', 'cheese_shop', 'wine_shop', 'grocery_store', 'food_court', 'catering_service']);
const CAFE = new Set(['coffee_shop', 'cafe', 'tea_room', 'internet_cafe']);
const BAR = new Set(['bar', 'tapas_bar', 'pub', 'wine_bar', 'cocktail_bar', 'beer_bar', 'brewery', 'lounge', 'sports_bar', 'beer_garden', 'irish_pub', 'gastropub', 'hookah_bar']);
const FAST = new Set(['fast_food_restaurant', 'sandwich_shop', 'doner_kebab_restaurant', 'food_truck_stand', 'hot_dog_restaurant', 'chicken_restaurant']);
const CUISINE_ALIAS = {
  doner_kebab_restaurant: 'kebab', sandwich_shop: 'sandwich', steakhouse: 'steak_house', pancake_house: 'crepe',
  salad_bar: 'salad', breakfast_and_brunch_restaurant: 'brunch', taco_restaurant: 'mexican', hot_dog_restaurant: 'hot_dog',
  chicken_restaurant: 'chicken', coffee_shop: 'coffee_shop', tapas_bar: 'tapas', ice_cream_shop: 'ice_cream',
  bar_and_grill_restaurant: 'steak_house', fish_and_chips_restaurant: 'fish_and_chips', noodle_restaurant: 'noodle',
};
const GENERIC = new Set(['restaurant', 'fast_food_restaurant', 'food_truck_stand', 'buffet_restaurant', 'halal_restaurant', 'bar', 'pub', 'wine_bar', 'cocktail_bar', 'beer_bar', 'brewery', 'lounge', 'cafe', 'tea_room', 'sports_bar']);

function classify(cat) {
  if (SKIP.has(cat)) return null;
  let k = 'restaurant';
  if (CAFE.has(cat)) k = 'cafe';
  else if (BAR.has(cat)) k = 'bar';
  else if (cat === 'ice_cream_shop') k = 'ice_cream';
  else if (FAST.has(cat)) k = 'fast_food';
  else if (!cat.includes('restaurant') && cat !== 'steakhouse' && cat !== 'pancake_house' && cat !== 'salad_bar') return null;
  let c = '';
  if (!GENERIC.has(cat)) c = CUISINE_ALIAS[cat] ?? cat.replace(/_restaurant$/, '');
  if (cat === 'tapas_bar') c = 'tapas';
  return { k, c };
}

// ── Dédoublonnage ─────────────────────────────────────────────────────────────
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['restaurant', 'le', 'la', 'les', 'l', 'chez', 'bar', 'cafe', 'brasserie', 'pizzeria', 'de', 'du', 'des', 'et', 'au', 'aux', 'a']);
const key = s => fold(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join('');
const meters = (a, b) => {
  const dy = (a.la - b.la) * 111_000;
  const dx = (a.ln - b.ln) * 111_000 * Math.cos((a.la * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
const cell = r => `${Math.floor(r.la * 1000)}:${Math.floor(r.ln * 1000)}`;
const grid = new Map();
const out = [];
const addToGrid = r => {
  const c = cell(r);
  if (!grid.has(c)) grid.set(c, []);
  grid.get(c).push(r);
};
const nearby = r => {
  const cy = Math.floor(r.la * 1000);
  const cx = Math.floor(r.ln * 1000);
  const found = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) found.push(...(grid.get(`${cy + dy}:${cx + dx}`) ?? []));
  return found;
};
const same = (a, b) => {
  if (meters(a, b) > 70) return false;
  const ka = key(a.n);
  const kb = key(b.n);
  if (!ka || !kb) return false;
  return ka === kb || (Math.min(ka.length, kb.length) >= 4 && (ka.includes(kb) || kb.includes(ka)));
};

for (const r of osm) {
  const rec = { ...r, t: r.t ?? '', s: 'o' };
  out.push(rec);
  addToGrid(rec);
}

let merged = 0;
let added = 0;
const used = new Set(out.map(r => r.id));
for (const v of ovt) {
  const cls = classify(v.cat);
  if (!cls) continue;
  const cand = { id: `ovt-${v.id.slice(0, 18)}`, n: v.n, k: cls.k, c: cls.c, la: v.la, ln: v.ln, a: v.a, h: '', w: v.w, t: v.t, d: 0, s: 'v' };
  const twin = nearby(cand).find(x => same(x, cand));
  if (twin) {
    // Complète la fiche existante sans écraser ce qu'OSM sait déjà
    if (!twin.a && cand.a) twin.a = cand.a;
    if (!twin.w && cand.w) twin.w = cand.w;
    if (!twin.t && cand.t) twin.t = cand.t;
    if (!twin.c && cand.c) twin.c = cand.c;
    twin.s = 'b';
    merged++;
    continue;
  }
  if (used.has(cand.id)) continue;
  used.add(cand.id);
  out.push(cand);
  addToGrid(cand);
  added++;
}

await writeFile('data/toulouse-places.json', JSON.stringify(out));
const by = k => out.filter(r => r.s === k).length;
console.log(`${out.length} lieux (OSM seul ${by('o')}, Overture seul ${by('v')}, fusionnés ${by('b')}) · ${merged} doublons fusionnés, ${added} ajouts Overture`);
