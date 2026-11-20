// Fonctions pures de la vérification des adresses (testées dans tests/addressVerify.test.ts). Aucun accès réseau ni disque.
import { fold, meters } from './addressAudit.mjs';

export const MAX_BAN_METERS = 150;
export const MAX_SIRENE_METERS = 200;
export const MIN_BAN_SCORE = 0.6;
/** Un score BAN plus bas (abréviations : « RD 813 ») est accepté si la position concorde à cette distance ou moins. */
export const LOW_SCORE_MAX_METERS = 60;
export const LOW_SCORE_FLOOR = 0.4;
export const MIN_NAME_SIMILARITY = 0.8;
/** Activités de restauration (NAF) : restauration traditionnelle, rapide, cafétérias, débits de boissons. */
export const SIRENE_ACTIVITIES = '56.10A,56.10B,56.10C,56.30Z';

// ── CSV (RFC 4180 simplifié : guillemets, virgules et retours à la ligne dans les champs) ──────────────

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (header, rows) => [header.join(','), ...rows.map(r => header.map(h => csvEscape(r[h])).join(','))].join('\n');

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// ── BAN (Base Adresse Nationale) ───────────────────────────────────────────────────────────────────────

/** Clé de cache d'un texte d'adresse (sans accents ni majuscules, espaces compactés). */
export const banKey = text => fold(text).replace(/\s+/g, ' ').trim();

/** Ligne de réponse du géocodage par lot de la BAN, convertie en nombres. */
export function banResultFrom(row) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  return {
    label: row.result_label || '',
    score: Number(row.result_score) || 0,
    type: row.result_type || '',
    name: row.result_name || '',
    postcode: row.result_postcode || '',
    city: row.result_city || '',
    lat: Number.isFinite(lat) && row.latitude !== '' ? lat : null,
    lng: Number.isFinite(lng) && row.longitude !== '' ? lng : null,
    status: row.result_status || '',
  };
}

/**
 * Une adresse géocodée correspond-elle à la fiche ? Raisons de refus : `non_geocode`, `type_trop_vague` (commune, lieu-dit),
 * `score_faible`, `coord_mismatch` (écart supérieur à 150 m entre l'adresse et la position de la fiche).
 */
export function checkBan(res, fiche, { maxMeters = MAX_BAN_METERS, minScore = MIN_BAN_SCORE } = {}) {
  if (!res || res.status !== 'ok' || res.lat === null || res.lng === null) return { ok: false, why: 'non_geocode' };
  const precision = res.type === 'housenumber' ? 'numero' : res.type === 'street' ? 'rue' : null;
  if (!precision) return { ok: false, why: 'type_trop_vague' };
  const dist = Math.round(meters({ la: fiche.la, ln: fiche.ln }, { la: res.lat, ln: res.lng }));
  if (res.score < minScore && !(res.score >= LOW_SCORE_FLOOR && dist <= LOW_SCORE_MAX_METERS)) return { ok: false, why: 'score_faible', dist };
  if (dist > maxMeters) return { ok: false, why: 'coord_mismatch', dist };
  return { ok: true, dist, precision };
}

/**
 * La BAN écrit certaines voies sans accent (« La Meridienne ») : on reprend l'orthographe du texte d'origine mot à mot
 * quand elle ne diffère que par les accents et la casse.
 */
export function restoreAccents(banName, original) {
  const words = new Map();
  for (const w of String(original ?? '').split(/[\s,]+/)) if (w) words.set(fold(w), w);
  return banName
    .split(' ')
    .map(w => {
      const o = words.get(fold(w));
      return o && /[^\x00-\x7f]/.test(o) ? o : w;
    })
    .join(' ');
}

/** Adresse affichée « 12 Rue Lafayette, 31000, Toulouse » à partir d'une réponse BAN validée et du texte d'origine. */
export function composeAddress(ban, original = '') {
  return `${restoreAccents(ban.name, original)}, ${ban.postcode}, ${ban.city}`;
}

// ── Noms (rapprochement avec SIRENE) ─────────────────────────────────────────────────────────────────────

const STOP = new Set(['restaurant', 'restauration', 'le', 'la', 'les', 'l', 'chez', 'bar', 'cafe', 'brasserie', 'pizzeria', 'de', 'du', 'des', 'et', 'au', 'aux', 'a', 'd']);
const LEGAL = new Set(['sarl', 'sas', 'sasu', 'eurl', 'sa', 'snc', 'scp', 'ei', 'societe', 'groupe', 'holding', 'toulouse', 'franchise', 'france']);

function nameTokens(s) {
  return fold(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w) && !LEGAL.has(w));
}

/** Ressemblance de deux noms, de 0 à 1 (recouvrement des mots significatifs ; au moins un mot commun d'au moins 3 lettres). */
export function nameSimilarity(a, b) {
  const A = new Set(nameTokens(a));
  const B = new Set(nameTokens(b));
  if (!A.size || !B.size) return 0;
  const common = [...A].filter(w => B.has(w));
  if (!common.some(w => w.length >= 3)) return 0;
  const union = new Set([...A, ...B]).size;
  const jaccard = common.length / union;
  const containment = common.length / Math.min(A.size, B.size);
  return Math.max(jaccard, containment * 0.9);
}

// ── SIRENE (recherche-entreprises.api.gouv.fr) ──────────────────────────────────────────────────────────

/** Établissements d'une réponse de recherche (ceux qui correspondent, plus le siège), avec tous les noms connus. */
export function flattenSirene(json) {
  const out = [];
  const seen = new Set();
  for (const r of json?.results ?? []) {
    const etabs = [...(r.matching_etablissements ?? []), ...(r.siege ? [r.siege] : [])];
    for (const e of etabs) {
      const key = e.siret ?? `${r.siren}:${e.adresse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        siret: e.siret ?? null,
        names: [r.nom_complet, r.nom_raison_sociale, r.sigle, e.nom_commercial, ...(e.liste_enseignes ?? [])].filter(Boolean),
        adresse: e.adresse ?? '',
        postcode: e.code_postal ?? '',
        city: e.libelle_commune ?? '',
        lat: e.latitude ? Number(e.latitude) : null,
        lng: e.longitude ? Number(e.longitude) : null,
        activity: e.activite_principale ?? '',
        active: e.etat_administratif === 'A',
      });
    }
  }
  return out;
}

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'au', 'aux', 'sur', 'en', 'd', 'l']);
/** « 23 RUE DU TAUR » devient « 23 Rue du Taur ». */
export function titleCaseFr(s) {
  return String(s ?? '')
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((w, i, all) => (/^[\s'-]+$/.test(w) || !w ? w : SMALL.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

/** « 1-2 1 PLACE DU CAPITOLE 31000 TOULOUSE » devient « 1-2 1 Place du Capitole, 31000, Toulouse ». */
export function formatSireneAddress(e) {
  let street = String(e.adresse ?? '').trim();
  const at = e.postcode ? street.indexOf(e.postcode) : -1;
  if (at >= 0) street = street.slice(0, at).trim();
  return `${titleCaseFr(street)}, ${e.postcode}, ${titleCaseFr(e.city)}`;
}

/** Meilleur établissement actif : nom très proche ET position à moins de 200 m de la fiche. Sinon null (à valider par un humain). */
export function pickSirene(establishments, fiche, { maxMeters = MAX_SIRENE_METERS, minSim = MIN_NAME_SIMILARITY } = {}) {
  let best = null;
  for (const e of establishments) {
    if (!e.active || e.lat === null || e.lng === null || !e.adresse) continue;
    // Établissement « non diffusible » (adresse masquée par l'INSEE) ou code postal illisible : aucune adresse publique à reprendre.
    if (/non.?diffusible/i.test(`${e.adresse} ${e.postcode} ${e.city}`) || !/^\d{5}$/.test(e.postcode)) continue;
    const dist = Math.round(meters({ la: fiche.la, ln: fiche.ln }, { la: e.lat, ln: e.lng }));
    if (dist > maxMeters) continue;
    const sim = Math.max(...e.names.map(n => nameSimilarity(fiche.n, n)), 0);
    if (sim < minSim) continue;
    if (!best || dist < best.dist || (dist === best.dist && sim > best.sim)) best = { e, dist, sim };
  }
  return best ? { text: formatSireneAddress(best.e), dist: best.dist, sim: Number(best.sim.toFixed(2)), siret: best.e.siret } : null;
}

// ── Site web du restaurant ──────────────────────────────────────────────────────────────────────────────

function pushAddress(out, a) {
  if (!a || typeof a !== 'object') return;
  const street = typeof a.streetAddress === 'string' ? a.streetAddress.replace(/\s+/g, ' ').trim() : '';
  const pc = typeof a.postalCode === 'string' || typeof a.postalCode === 'number' ? String(a.postalCode).trim() : '';
  const city = typeof a.addressLocality === 'string' ? a.addressLocality.trim() : '';
  if (street && /^\d{5}$/.test(pc)) out.push(`${street}, ${pc}, ${city}`.replace(/, $/, ''));
}

const TEXT_ADDRESS = /(\d{1,4}(?:\s?(?:bis|ter))?)[ ,]+((?:[A-Za-zÀ-ÿ'’.-]+\s+){1,7}?[A-Za-zÀ-ÿ'’.-]+),?\s+(31\d{3})\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’]*(?:-[A-Za-zÀ-ÿ'’]+)*)/g;

/** Adresses haut-garonnaises écrites en clair dans un texte (« 35 Rue du Taur, 31000 Toulouse »), par exemple la liste des agences d'une chaîne. */
export function extractTextAddresses(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(TEXT_ADDRESS)) out.push(`${m[1]} ${m[2].trim()}, ${m[3]}, ${m[4]}`);
  return out;
}

const MAX_PAGE_ADDRESSES = 40;

/**
 * Adresses lues dans la page : JSON-LD `PostalAddress`, balise `<address>` puis adresses écrites en clair (code postal 31xxx exigé).
 * Une page de chaîne en liste beaucoup : seule celle qui tombe à 150 m ou moins de la fiche sera retenue par la BAN.
 */
export function extractAddressesFromHtml(html) {
  const found = [];
  for (const m of String(html ?? '').matchAll(/<script\b[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (node.address) {
          if (Array.isArray(node.address)) node.address.forEach(a => pushAddress(found, a));
          else pushAddress(found, node.address);
        }
        if (node.streetAddress) pushAddress(found, node);
        for (const v of Object.values(node)) walk(v);
      };
      walk(JSON.parse(m[1]));
    } catch {
      /* JSON-LD invalide : ignoré */
    }
  }
  for (const m of String(html ?? '').matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (/\b\d{5}\b/.test(text) && text.length < 200) found.push(text);
  }
  const stripped = String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  found.push(...extractTextAddresses(stripped));
  // Même adresse lue deux fois (balise puis texte) : on garde la première, à la ponctuation et aux espaces près.
  const seen = new Set();
  const unique = found.filter(t => {
    const k = fold(t).replace(/[,\s]+/g, ' ').trim();
    return seen.has(k) ? false : seen.add(k);
  });
  return unique.slice(0, MAX_PAGE_ADDRESSES);
}

// ── Décision ───────────────────────────────────────────────────────────────────────────────────────────

/** Ordre de précédence de la source de l'adresse affichée. */
export const SOURCE_ORDER = ['osm', 'overture', 'sirene', 'site'];

/**
 * Choisit l'adresse affichée. `candidates` : { src, text, ban } avec `ban` = réponse BAN (ou null), plus `sireneGeo`
 * (établissement SIRENE dont la position concorde mais que la BAN ne sait pas géocoder). Les candidats sont triés par précédence.
 * Retour : { a, av: 'ok' | 'none', src, p?, why? }. Jamais « approx » ici : une adresse de repli n'est jamais affichée.
 */
export function decideAddress(fiche, candidates) {
  const ordered = [...candidates].sort((x, y) => SOURCE_ORDER.indexOf(x.src) - SOURCE_ORDER.indexOf(y.src));
  const reasons = [];
  for (const c of ordered) {
    if (c.sireneGeo) return { a: c.text, av: 'ok', src: 'sirene', p: null };
    const check = checkBan(c.ban, fiche);
    if (check.ok) return { a: composeAddress(c.ban, c.text), av: 'ok', src: `${c.src}+ban`, p: check.precision };
    reasons.push(check.why);
  }
  if (!ordered.length) return { a: null, av: 'none', src: 'aucune_source' };
  const why = reasons.includes('coord_mismatch') ? 'coord_mismatch' : reasons.find(r => r !== 'non_geocode') ?? 'non_geocode';
  return { a: null, av: 'none', src: why };
}
