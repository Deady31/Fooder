#!/usr/bin/env node
/**
 * Vérifie l'adresse de chaque fiche présentable (restaurant et fast_food) avec des sources publiques gratuites et sans clé.
 *  1. BAN (Base Adresse Nationale), géocodage par lot : l'adresse doit se situer à 150 m ou moins de la position de la fiche.
 *  2. SIRENE (recherche-entreprises.api.gouv.fr) pour les fiches restées sans adresse validée : nom très proche ET position à moins de 200 m.
 *  3. Site web du restaurant (JSON-LD PostalAddress, balise <address>), validé ensuite par la BAN.
 * Précédence de l'adresse affichée : OSM validée > Overture validée > SIRENE > site. Une adresse « la plus proche d'un point » n'est jamais affichée.
 *
 * Reprenable et idempotent : chaque réponse est mise en cache dans data/cache/ (hors git). Relancer ne refait que ce qui manque.
 * Écrit : data/addresses-verified.json (versionné), data/review/a-valider-par-riyan.csv et data/review/verify-report.json (hors git).
 *
 * Usage : node scripts/verify-addresses.mjs [--phase=all|ban|sirene|site|decide] [--limit=N] [--offline] [--refresh]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './lib/loadTs.mjs';
import { clusterByName, fold, nameKey, sameVenue } from './lib/addressAudit.mjs';
import {
  SIRENE_ACTIVITIES, banKey, banResultFrom, checkBan, decideAddress, extractAddressesFromHtml, flattenSirene, parseCsv, pickSirene, toCsv,
} from './lib/addressVerify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? '1']; }));
const PHASE = args.phase ?? 'all';
const LIMIT = Number(args.limit ?? 0);
const OFFLINE = Boolean(args.offline);
const REFRESH = Boolean(args.refresh);
const UA = 'FooderAddressCheck/1.0 (+https://github.com/Deady31/Fooder; verification des adresses, 1 requete/s par site)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const rel = (...p) => path.join(ROOT, ...p);
const readJson = async (p, fb) => { try { return JSON.parse((await fs.readFile(p, 'utf8')).replace(/^﻿/, '')); } catch { return fb; } };
const writeJson = async (p, v, indent) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(v, null, indent) + '\n'); };

// ── Données ────────────────────────────────────────────────────────────────────────────────────────────
const { isPresentableBase, completeness } = await loadTs('lib/osm.ts');
const { quartierAt } = await loadTs('lib/quartiersGeo.ts');
const places = await readJson(rel('data', 'toulouse-places.json'), []);
const osmRaw = new Map((await readJson(rel('data', 'raw', 'osm.json'), [])).map(r => [r.id, r.a ?? '']));
const ovtRaw = await readJson(rel('data', 'raw', 'overture.json'), []);
const cell = r => `${Math.floor(r.la * 1000)}:${Math.floor(r.ln * 1000)}`;
const grid = new Map();
for (const v of ovtRaw) { const c = cell(v); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(v); }
const twinOf = r => {
  const cy = Math.floor(r.la * 1000), cx = Math.floor(r.ln * 1000);
  const near = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.push(...(grid.get(`${cy + dy}:${cx + dx}`) ?? []));
  return near.find(v => sameVenue(r, v) && v.a);
};

let fiches = places.filter(r => (r.k === 'restaurant' || r.k === 'fast_food') && isPresentableBase(r));
if (LIMIT) fiches = fiches.slice(0, LIMIT);

/** Adresses candidates d'une fiche, par source, sans doublon (même texte à la casse et aux accents près). */
function textCandidates(r) {
  const out = [];
  const add = (src, text) => { if (text && !out.some(c => banKey(c.text) === banKey(text))) out.push({ src, text }); };
  if (r.s === 'v') add('overture', r.a);
  else {
    add('osm', osmRaw.get(r.id) || (r.s === 'o' ? r.a : ''));
    if (r.s === 'b') add('overture', twinOf(r)?.a);
  }
  if (!out.length && r.a) add(r.s === 'v' ? 'overture' : 'osm', r.a);
  return out;
}

// ── Caches ─────────────────────────────────────────────────────────────────────────────────────────────
const BAN_CACHE = rel('data', 'cache', 'ban.json');
const SIRENE_CACHE = rel('data', 'cache', 'sirene.json');
const SITE_CACHE = rel('data', 'cache', 'site.json');
/** Version de l'extraction des adresses des sites : l'incrémenter refait la lecture des sites déjà en cache. */
const SITE_CACHE_VERSION = 2;
const banCache = REFRESH ? {} : await readJson(BAN_CACHE, {});
const sireneCache = REFRESH ? {} : await readJson(SIRENE_CACHE, {});
const siteCache = REFRESH ? {} : await readJson(SITE_CACHE, {});

// ── BAN : géocodage par lot CSV ────────────────────────────────────────────────────────────────────────
async function banPass(texts) {
  const missing = [...new Map(texts.map(t => [banKey(t), t])).entries()].filter(([k]) => !(k in banCache));
  if (!missing.length || OFFLINE) return log(`BAN : ${missing.length} adresse(s) à géocoder${OFFLINE ? ' (hors ligne : ignoré)' : ''}`);
  log(`BAN : ${missing.length} adresse(s) à géocoder`);
  const CHUNK = 800;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const part = missing.slice(i, i + CHUNK);
    const csv = toCsv(['id', 'adresse'], part.map(([, text], j) => ({ id: String(j), adresse: text })));
    const form = new FormData();
    form.append('data', new Blob([csv], { type: 'text/csv' }), 'adresses.csv');
    form.append('columns', 'adresse');
    for (const c of ['result_label', 'result_score', 'result_type', 'result_name', 'result_postcode', 'result_city', 'latitude', 'longitude', 'result_status']) form.append('result_columns', c);
    let rows = null;
    for (let attempt = 1; attempt <= 3 && !rows; attempt++) {
      try {
        const res = await fetch('https://api-adresse.data.gouv.fr/search/csv/', { method: 'POST', body: form, headers: { 'user-agent': UA }, signal: AbortSignal.timeout(180_000) });
        if (!res.ok) throw new Error(`http ${res.status}`);
        rows = parseCsv(await res.text());
      } catch (e) {
        log(`BAN lot ${i / CHUNK + 1} : échec (${e.message}), nouvel essai`);
        await sleep(3000 * attempt);
      }
    }
    if (!rows) { log('BAN : lot abandonné, relancer le script pour reprendre'); continue; }
    for (const row of rows) banCache[part[Number(row.id)][0]] = banResultFrom(row);
    await writeJson(BAN_CACHE, banCache);
    log(`BAN : ${Math.min(i + CHUNK, missing.length)}/${missing.length}`);
    await sleep(1000);
  }
}

// ── Chaînes : l'adresse d'une agence peut figurer sur le site de la chaîne (lu pour une autre agence du même nom) ──
let chainIndex = new Map();
function buildChainIndex() {
  chainIndex = new Map();
  for (const r of fiches) {
    const texts = siteCache[r.id]?.texts;
    if (!texts?.length) continue;
    const k = nameKey(r.n);
    if (!chainIndex.has(k)) chainIndex.set(k, new Set());
    for (const t of texts) chainIndex.get(k).add(t);
  }
}

// ── Construction des candidats d'une fiche à partir des caches ────────────────────────────────────────
function candidatesFor(r) {
  const out = textCandidates(r).map(c => ({ ...c, ban: banCache[banKey(c.text)] ?? null }));
  const sir = sireneCache[r.id]?.pick;
  if (sir) {
    const ban = banCache[banKey(sir.text)] ?? null;
    out.push(checkBan(ban, r).ok ? { src: 'sirene', text: sir.text, ban } : { src: 'sirene', text: sir.text, ban: null, sireneGeo: true });
  }
  // Adresses du site du restaurant, puis celles du site d'une autre agence du même nom. Toutes passent par le même contrôle de position (150 m).
  const siteTexts = new Set([...(siteCache[r.id]?.texts ?? []), ...(chainIndex.get(nameKey(r.n)) ?? [])]);
  for (const t of siteTexts) out.push({ src: 'site', text: t, ban: banCache[banKey(t)] ?? null });
  return out;
}
const unresolved = () => {
  buildChainIndex();
  return fiches.filter(r => decideAddress(r, candidatesFor(r)).av !== 'ok');
};

// ── SIRENE ──────────────────────────────────────────────────────────────────────────────────────────────
async function sirenePass() {
  const todo = unresolved().filter(r => !(r.id in sireneCache));
  log(`SIRENE : ${todo.length} fiche(s) à interroger (≈ 5 requêtes/s)`);
  if (OFFLINE) return;
  let n = 0;
  for (const r of todo) {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(r.n)}&departement=31&etat_administratif=A&activite_principale=${SIRENE_ACTIVITIES}&per_page=25`;
    let json = null;
    for (let attempt = 1; attempt <= 4 && !json; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
        if (res.status === 429) { await sleep(2500 * attempt); continue; }
        if (!res.ok) throw new Error(`http ${res.status}`);
        json = await res.json();
      } catch (e) {
        if (attempt === 4) log(`SIRENE ${r.id} : échec (${e.message})`);
        await sleep(1000 * attempt);
      }
    }
    if (json) {
      const found = flattenSirene(json);
      sireneCache[r.id] = { at: new Date().toISOString().slice(0, 10), pick: pickSirene(found, r) };
    }
    if (++n % 50 === 0) { log(`SIRENE : ${n}/${todo.length}`); await writeJson(SIRENE_CACHE, sireneCache); }
    await sleep(210);
  }
  await writeJson(SIRENE_CACHE, sireneCache);
}

// ── Sites web : 1 requête par seconde et par site, robots.txt respecté ───────────────────────────────
const robots = new Map();
async function robotsAllow(url) {
  const origin = new URL(url).origin;
  if (!robots.has(origin)) {
    const rules = { disallow: [], allow: [] };
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        let applies = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const line = raw.replace(/#.*$/, '').trim();
          const [key, ...rest] = line.split(':');
          const value = rest.join(':').trim();
          if (/^user-agent$/i.test(key)) applies = value === '*' || /fooder/i.test(value);
          else if (applies && /^disallow$/i.test(key) && value) rules.disallow.push(value);
          else if (applies && /^allow$/i.test(key) && value) rules.allow.push(value);
        }
      }
    } catch { /* pas de robots.txt lisible : autorisé */ }
    robots.set(origin, rules);
  }
  const { disallow, allow } = robots.get(origin);
  const p = new URL(url).pathname || '/';
  const hit = list => list.filter(x => p.startsWith(x)).sort((a, b) => b.length - a.length)[0];
  const d = hit(disallow);
  return !d || Boolean(hit(allow) && hit(allow).length > d.length);
}

const lastHit = new Map();
async function politeGet(url) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + 1000 - Date.now();
  lastHit.set(host, Date.now() + Math.max(0, wait));
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
  const html = await res.text();
  return html.length > 3_000_000 ? null : html;
}

async function siteOne(r) {
  let page;
  try { page = new URL(r.w).toString(); } catch { return { status: 'url-invalide', texts: [] }; }
  try {
    if (!(await robotsAllow(page))) return { status: 'robots', texts: [] };
    let html = await politeGet(page);
    if (!html) return { status: 'page-illisible', texts: [] };
    let texts = extractAddressesFromHtml(html);
    if (!texts.length) {
      const link = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)].find(m => /contact|acc[eè]s|infos?|o[uù]-nous-trouver/i.test(`${m[1]} ${m[2]}`));
      if (link) {
        const contact = new URL(link[1], page).toString();
        if (new URL(contact).host === new URL(page).host && (await robotsAllow(contact))) {
          html = await politeGet(contact);
          if (html) texts = extractAddressesFromHtml(html);
        }
      }
    }
    return { status: texts.length ? 'ok' : 'aucune-adresse', texts };
  } catch (e) {
    return { status: e.name === 'TimeoutError' ? 'timeout' : 'injoignable', texts: [] };
  }
}

async function sitePass() {
  const todo = unresolved().filter(r => r.w && siteCache[r.id]?.v !== SITE_CACHE_VERSION);
  log(`Sites : ${todo.length} site(s) à lire (1 requête/s par site)`);
  if (OFFLINE) return;
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < todo.length) {
      const r = todo[i++];
      siteCache[r.id] = { v: SITE_CACHE_VERSION, at: new Date().toISOString().slice(0, 10), ...(await siteOne(r)) };
      if (++done % 25 === 0) { log(`Sites : ${done}/${todo.length}`); await writeJson(SITE_CACHE, siteCache); }
    }
  }));
  await writeJson(SITE_CACHE, siteCache);
}

// ── Décision, doublons, sorties ───────────────────────────────────────────────────────────────────────
async function decidePhase() {
  buildChainIndex();
  const overlay = {};
  const review = [];
  const causeCount = {};
  const srcCount = {};
  const precision = {};
  for (const r of fiches) {
    const cands = candidatesFor(r);
    const d = decideAddress(r, cands);
    // Quartier officiel par point-dans-polygone (contours de la Mairie de Toulouse) ; null hors de Toulouse.
    // Pas de quartier de Toulouse pour une adresse vérifiée dans une autre commune (fiche en limite de polygone, ex. Colomiers).
    const q = d.av === 'ok' && fold((d.a ?? '').split(',').pop() ?? '').trim() !== 'toulouse' ? null : quartierAt(r.la, r.ln);
    overlay[r.id] = d.av === 'ok' ? { a: d.a, q, av: 'ok', src: d.src, p: d.p } : { a: null, q, av: 'none', src: d.src };
    if (d.av === 'ok') {
      srcCount[d.src] = (srcCount[d.src] ?? 0) + 1;
      precision[d.p ?? 'sirene'] = (precision[d.p ?? 'sirene'] ?? 0) + 1;
      // OSM et Overture validés tous deux mais avec des adresses différentes : on garde la précédence, mais on le signale.
      const oks = cands.filter(c => c.ban && checkBan(c.ban, r).ok && (c.src === 'osm' || c.src === 'overture'));
      if (oks.length > 1 && banKey(oks[0].ban.name) !== banKey(oks[1].ban.name)) review.push({ id: r.id, nom: r.n, lat: r.la, lng: r.ln, raison: 'osm_overture_differents', candidats: oks.map(c => `${c.src}: ${c.text}`).join(' | ') });
    } else {
      causeCount[d.src] = (causeCount[d.src] ?? 0) + 1;
      const sir = sireneCache[r.id]?.pick;
      review.push({ id: r.id, nom: r.n, lat: r.la, lng: r.ln, raison: d.src, candidats: [...cands.map(c => `${c.src}: ${c.text}`), sir ? `sirene: ${sir.text} (${sir.dist} m)` : ''].filter(Boolean).join(' | ') });
    }
  }
  // Vrais doublons (même nom, 50 m ou moins) : on garde la fiche la plus riche dont l'adresse est validée.
  let merged = 0;
  for (const dup of clusterByName(fiches, 50).duplicates) {
    const ok = dup.ids.filter(id => overlay[id].av === 'ok');
    if (ok.length === 1) {
      for (const id of dup.ids) if (id !== ok[0]) { overlay[id].dup = ok[0]; merged++; }
      continue;
    }
    if (ok.length < 2) continue;
    if (new Set(ok.map(id => banKey(overlay[id].a))).size > 1) { review.push({ id: ok.join('+'), nom: dup.key, lat: '', lng: '', raison: 'doublon_adresses_differentes', candidats: ok.map(id => overlay[id].a).join(' | ') }); continue; }
    const rank = id => completeness(places.find(p => p.id === id));
    const kept = [...ok].sort((a, b) => rank(b) - rank(a) || (a < b ? -1 : 1))[0];
    for (const id of ok) if (id !== kept) { overlay[id].dup = kept; merged++; }
  }
  const sorted = Object.fromEntries(Object.entries(overlay).sort(([a], [b]) => (a < b ? -1 : 1)));
  await fs.writeFile(rel('data', 'addresses-verified.json'), '{\n' + Object.entries(sorted).map(([id, e]) => `${JSON.stringify(id)}:${JSON.stringify(e)}`).join(',\n') + '\n}\n');
  await fs.mkdir(rel('data', 'review'), { recursive: true });
  await fs.writeFile(rel('data', 'review', 'a-valider-par-riyan.csv'), '﻿' + toCsv(['id', 'nom', 'lat', 'lng', 'raison', 'candidats'], review) + '\n');
  const ok = Object.values(sorted).filter(e => e.av === 'ok' && !e.dup).length;
  const report = { fiches: fiches.length, servies: ok, retirees: fiches.length - ok, doublonsFusionnes: merged, causes: causeCount, sources: srcCount, precision, aValider: review.length };
  await writeJson(rel('data', 'review', 'verify-report.json'), report, 1);
  const pct = n => `${((n / fiches.length) * 100).toFixed(1)} %`;
  console.log(`\nAvant : ${fiches.length} fiches présentables · Après : ${ok} avec adresse vérifiée (${pct(ok)}), ${fiches.length - ok} retirées, ${merged} doublon(s) fusionné(s)`);
  console.log('Causes de retrait :', causeCount);
  console.log('Source de l\'adresse affichée :', srcCount, '· précision :', precision);
  console.log(`À valider par Riyan : ${review.length} ligne(s) dans data/review/a-valider-par-riyan.csv`);
}

if (PHASE === 'all' || PHASE === 'ban') await banPass(fiches.flatMap(r => textCandidates(r).map(c => c.text)));
if (PHASE === 'all' || PHASE === 'sirene') {
  await sirenePass();
  await banPass(Object.values(sireneCache).filter(x => x.pick).map(x => x.pick.text));
}
if (PHASE === 'all' || PHASE === 'site') {
  await sitePass();
  await banPass(Object.values(siteCache).flatMap(x => x.texts ?? []));
}
if (PHASE === 'all' || PHASE === 'decide') await decidePhase();
