// Étape 4 : candidates de photos de plats pour les fiches servies sans photo mais avec site.
//   node scripts/photos-candidates.mjs [--phase=discover|download|all] [--limit=N] [--ids=a,b]
// Poli : 1 requête/seconde et par site, robots.txt respecté, User-Agent déclaré. Aucune image Google.
// Sorties (ignorées par git) : data/cache/photo-candidates.json, data/cache/photo-files.json, data/photos-raw/<id>/<n>.<ext>.
import fs from 'node:fs';
import path from 'node:path';
import { dHash, ffprobeSize } from './lib/imageTools.mjs';
import { loadTs } from './lib/loadTs.mjs';
import { checkImageSize, createHostThrottle, dedupeByHash, isExcludedImageUrl, rankCandidates, robotsAllowed } from './lib/photoSelect.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const phase = args.phase ?? 'all';
const LIMIT = Number(args.limit ?? Infinity);
const ONLY = args.ids ? new Set(String(args.ids).split(',')) : null;
const UA = 'FooderPhotoBot/1.0 (+https://github.com/Deady31/Fooder)';
const CAND_FILE = 'data/cache/photo-candidates.json';
const FILES_FILE = 'data/cache/photo-files.json';
const RAW = 'data/photos-raw';
const MAX_KEEP_PER_FICHE = 3;
const MAX_TRY_PER_FICHE = 8;
const CONCURRENCY = 10;
/** Sites qui ne sont pas un site de restaurant : réseaux sociaux, agrégateurs, pages de liens. */
const NOT_A_SITE = /(facebook|instagram|linktr\.ee|lafourchette|thefork|tripadvisor|ubereats|deliveroo|just-eat|google\.|goo\.gl)/i;

const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const throttle = createHostThrottle(1000);
const robotsCache = new Map();

async function politeFetch(url, opts = {}) {
  const u = new URL(url);
  const wait = throttle(u.host);
  if (wait > 0) await sleep(wait);
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(opts.timeout ?? 12000), headers: { 'user-agent': UA, accept: opts.accept ?? '*/*', 'accept-language': 'fr' } });
}

async function robotsAllows(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let text = '';
    try {
      const res = await politeFetch(`${u.origin}/robots.txt`, { timeout: 6000 });
      if (res.ok && /text|plain/i.test(res.headers.get('content-type') ?? 'text')) text = await res.text();
    } catch { /* robots illisible : on autorise */ }
    robotsCache.set(u.origin, text);
  }
  return robotsAllowed(robotsCache.get(u.origin), u.pathname + u.search);
}

const absolute = (href, base) => { try { return new URL(href.replace(/&amp;/g, '&'), base).href; } catch { return null; } };

function imagesFromHtml(html, base, rank) {
  const out = [];
  const add = (u, r) => { const a = u && absolute(u, base); if (a) out.push({ url: a, rank: r, page: base }); };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/gi)) {
    const c = /content=["']([^"']+)["']/i.exec(m[0]);
    add(c?.[1], rank + 40);
  }
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        for (const [k, v] of Object.entries(n)) {
          if (k === 'image' || k === 'photo') [].concat(v).forEach(x => add(typeof x === 'string' ? x : x?.url ?? x?.contentUrl, rank + 35));
          else walk(v);
        }
      };
      walk(JSON.parse(m[1]));
    } catch { /* JSON-LD invalide */ }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcset = /(?:data-)?srcset=["']([^"']+)["']/i.exec(tag)?.[1];
    let best;
    if (srcset) {
      const parts = srcset.split(',').map(s => s.trim().split(/\s+/)).filter(p => p[0]);
      parts.sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'));
      best = parts[0]?.[0];
    }
    best ??= /(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i.exec(tag)?.[1];
    if (best && !/^data:/.test(best)) add(best, rank);
  }
  return out;
}

const SUBPAGE = /(menu|carte|galerie|gallery|photos?|plats?|nos-|specialit|cuisine)/i;
function subpages(html, base) {
  const host = new URL(base).host;
  const set = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const u = absolute(m[1], base);
    if (!u || new URL(u).host !== host || /\.(pdf|jpe?g|png|webp|zip)(\?|$)/i.test(u)) continue;
    if (SUBPAGE.test(new URL(u).pathname) || /\b(carte|menu|galerie|photos|plats)\b/i.test(m[2].replace(/<[^>]+>/g, ''))) set.add(u);
  }
  set.delete(base);
  return [...set].slice(0, 2);
}

async function fetchHtml(url) {
  if (!(await robotsAllows(url))) return { html: null, why: 'robots' };
  try {
    const res = await politeFetch(url, { accept: 'text/html' });
    if (!res.ok) return { html: null, why: `http-${res.status}` };
    if (!/html/i.test(res.headers.get('content-type') ?? '')) return { html: null, why: 'pas-html' };
    const buf = Buffer.from(await res.arrayBuffer());
    return { html: buf.subarray(0, 1_500_000).toString('utf8') };
  } catch (e) { return { html: null, why: e.cause?.code ?? e.name }; }
}

async function discoverOne(rec) {
  const home = /^https?:/i.test(rec.w) ? rec.w : `http://${rec.w}`;
  const { html, why } = await fetchHtml(home);
  if (!html) return { page: home, cands: [], error: why };
  let cands = imagesFromHtml(html, home, 50);
  const pages = [];
  for (const sp of subpages(html, home)) {
    const h = (await fetchHtml(sp)).html;
    if (!h) continue;
    pages.push(sp);
    cands = cands.concat(imagesFromHtml(h, sp, 60));
  }
  const seen = new Set();
  const kept = [];
  for (const c of rankCandidates(cands)) {
    const key = c.url.split('?')[0];
    if (seen.has(key) || isExcludedImageUrl(c.url)) continue;
    seen.add(key);
    kept.push(c);
    if (kept.length >= 14) break;
  }
  return { page: home, pages, cands: kept };
}

async function pool(items, worker) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const it = items[i++];
      try { await worker(it); } catch (e) { console.error('erreur', it.id ?? it, e.message); }
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function downloadOne(id, entry, files) {
  const got = [];
  let tried = 0;
  for (const c of entry.cands) {
    if (got.length >= MAX_KEEP_PER_FICHE || tried >= MAX_TRY_PER_FICHE) break;
    tried++;
    let res;
    try {
      if (!(await robotsAllows(c.url))) continue;
      res = await politeFetch(c.url, { accept: 'image/*', timeout: 15000 });
    } catch { continue; }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = EXT[type];
    if (!res.ok || !ext) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 10_000_000) continue;
    const n = got.length + 1;
    const dir = path.join(RAW, id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${n}.${ext}`);
    fs.writeFileSync(file, buf);
    const { width, height } = ffprobeSize(file);
    const reject = checkImageSize({ width, height, bytes: buf.length });
    const hash = reject ? null : dHash(file);
    if (reject || !hash || dedupeByHash([...got, { hash }]).length === got.length) { fs.rmSync(file); continue; }
    got.push({ key: `${id}#${n}`, id, file: file.replace(/\\/g, '/'), url: c.url, page: c.page ?? entry.page, width, height, bytes: buf.length, hash, type });
  }
  for (const g of got) files[g.key] = g;
  files[`${id}#done`] = { id, n: got.length };
}

const { isPresentable } = await loadTs('lib/osm.ts');
const places = JSON.parse(fs.readFileSync('data/toulouse-places.json', 'utf8'));
const consented = readJson('data/photos-consented.json', {});
const blocklist = readJson('data/photo-blocklist.json', {});
const blockedMap = blocklist.blocked ?? {};
const targets = places
  .filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentable(r) && r.w && !NOT_A_SITE.test(r.w) && !(consented[r.id] && !blockedMap[r.id]) && blockedMap[r.id]?.source !== 'manual')
  .filter(r => !ONLY || ONLY.has(r.id))
  .slice(0, LIMIT);
console.log(`cibles : ${targets.length} fiches servies sans photo, avec site`);

const cands = readJson(CAND_FILE, {});
if (phase === 'all' || phase === 'discover') {
  const todo = targets.filter(r => !cands[r.id]);
  console.log(`découverte : ${todo.length} à faire`);
  let n = 0;
  await pool(todo, async r => {
    cands[r.id] = await discoverOne(r);
    if (++n % 25 === 0) writeJson(CAND_FILE, cands);
  });
  writeJson(CAND_FILE, cands);
  const errs = {};
  for (const r of targets) if (cands[r.id]?.error) errs[cands[r.id].error] = (errs[cands[r.id].error] ?? 0) + 1;
  const withC = targets.filter(r => cands[r.id]?.cands?.length).length;
  console.log(`découverte finie : ${withC}/${targets.length} fiches avec au moins une candidate ; erreurs`, errs);
}
if (phase === 'all' || phase === 'download') {
  const files = readJson(FILES_FILE, {});
  const todo = targets.filter(r => cands[r.id]?.cands?.length && !files[`${r.id}#done`]);
  console.log(`téléchargement : ${todo.length} à faire`);
  let n = 0;
  await pool(todo.map(r => ({ id: r.id })), async ({ id }) => {
    await downloadOne(id, cands[id], files);
    if (++n % 25 === 0) writeJson(FILES_FILE, files);
  });
  writeJson(FILES_FILE, files);
  const withF = targets.filter(r => Object.keys(files).some(k => k.startsWith(`${r.id}#`) && !k.endsWith('#done'))).length;
  console.log(`téléchargement fini : ${withF} fiches avec au moins une image valable`);
}
