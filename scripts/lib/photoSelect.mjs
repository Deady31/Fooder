// Logique pure du pipeline de photos de plats (testée dans tests/photoSelect.test.ts). Aucun accès réseau ni disque.

export const CLASSES = ['plat', 'facade', 'interieur', 'logo', 'carte', 'menu', 'personnes', 'autre'];
/** Seuil de confiance pour garder une photo « plat » sans second avis. */
export const KEEP_CONFIDENCE = 0.8;
/** En dessous : rejet net. Entre les deux : second avis (modèle plus fort). */
export const REVIEW_FLOOR = 0.5;
export const MIN_WIDTH = 600;
export const MIN_HEIGHT = 400;
export const MAX_HASH_DISTANCE = 4;

/** Hôtes dont on ne prend JAMAIS d'image : Google (Maps, Places, Images, photos d'utilisateurs) et cartes statiques. */
const FORBIDDEN_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|gstatic\.com|googleapis\.com|google\.[a-z.]+|googleadservices\.com|doubleclick\.net|streetviewpixels[^/]*|mapbox\.com|openstreetmap\.org|tile\.openstreetmap\.[a-z]+|facebook\.com|fbcdn\.net|instagram\.com|cdninstagram\.com|tripadvisor\.[a-z.]+|tacdn\.com|ubereats\.com|deliveroo\.[a-z.]+|just-eat\.[a-z.]+)$/i;
/** Mots du chemin qui trahissent un visuel qui n'est pas un plat. */
const BAD_PATH = /(logo|favicon|sprite|placeholder|avatar|pixel|spacer|transparent|1x1|badge|icone|icon-|staticmap|static-map|map-|carte-|plan-|qr|banner|banniere|bandeau|header|footer|flyer|affiche|screenshot|capture|facade|devanture|storefront|vitrine|exterieur|blur|thumb|x100|x150|x200)/i;

/** Image exclue d'office, avant même de la télécharger. */
export function isExcludedImageUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'url-invalide';
  }
  if (!/^https?:$/.test(u.protocol)) return 'protocole';
  if (FORBIDDEN_HOST.test(u.hostname)) return 'hote-interdit';
  if (/\.(svg|gif|ico)(\?|$)/i.test(u.pathname)) return 'format';
  if (BAD_PATH.test(decodeURIComponent(u.pathname))) return 'nom-suspect';
  return null;
}

/** Contrôles de l'image téléchargée. Retourne la raison du rejet, ou null. */
export function checkImageSize({ width, height, bytes }) {
  if (!width || !height) return 'dimensions-illisibles';
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return 'trop-petite';
  const ratio = width / height;
  if (ratio < 0.5 || ratio > 3.2) return 'ratio';
  if (bytes < 15_000) return 'trop-legere';
  // Un logo ou un aplat se compresse à presque rien : une vraie photo dépasse ~0,06 octet par pixel.
  if (bytes / (width * height) < 0.06) return 'aplat';
  return null;
}

/** Distance de Hamming entre deux empreintes perceptuelles hexadécimales de même longueur. */
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Garde la première image de chaque groupe d'images quasi identiques (empreinte à `maxDist` bits ou moins). */
export function dedupeByHash(items, maxDist = MAX_HASH_DISTANCE) {
  const kept = [];
  for (const it of items) if (!kept.some(k => hamming(k.hash, it.hash) <= maxDist)) kept.push(it);
  return kept;
}

/** Ordre des candidats d'une page : source la plus fiable d'abord (rang), puis la plus large. */
export function rankCandidates(cands) {
  return [...cands].sort((a, b) => b.rank - a.rank || (b.width ?? 0) - (a.width ?? 0) || (a.url < b.url ? -1 : 1));
}

/** Verdict d'une ligne de tri par vision : 'keep', 'review' (second avis) ou 'reject'. */
export function visionVerdict(row) {
  if (!row || !CLASSES.includes(row.classe)) return 'review';
  const c = Number(row.confiance);
  if (!Number.isFinite(c)) return 'review';
  if (row.classe === 'plat') return c >= KEEP_CONFIDENCE ? 'keep' : c >= REVIEW_FLOOR ? 'review' : 'reject';
  // Pas un plat : rejet net si le modèle est sûr, sinon un second avis (il peut s'être trompé sur un plat en bannière).
  return c >= KEEP_CONFIDENCE ? 'reject' : 'review';
}

/** Lit le fichier JSON écrit par un sous-agent de tri : tableau d'objets {idx, classe, confiance}. Lignes invalides ignorées. */
export function parseVisionRows(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^﻿/, '').replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.photos) ? data.photos : [];
  return list
    .filter(r => r && Number.isInteger(r.idx) && CLASSES.includes(r.classe) && Number.isFinite(Number(r.confiance)))
    .map(r => ({ idx: r.idx, classe: r.classe, confiance: Math.min(1, Math.max(0, Number(r.confiance))) }));
}

/**
 * Meilleure photo d'un restaurant parmi ses candidates « plat » retenues. Score : confiance, résolution et finesse
 * (octets par pixel, proxy de netteté). Déterministe : à égalité, l'identifiant le plus petit.
 */
export function pickBest(candidates) {
  const scored = candidates.map(c => ({
    c,
    score: c.confiance * 100 + Math.min(c.width, 1600) / 40 + Math.min(c.bytes / (c.width * c.height), 0.6) * 60,
  }));
  scored.sort((a, b) => b.score - a.score || (a.c.key < b.c.key ? -1 : 1));
  return scored[0]?.c ?? null;
}

/** Découpe une liste en lots de `size` éléments (planches-contacts de 36). */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const ruleRegex = p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

/**
 * robots.txt : le texte est-il favorable à notre robot pour ce chemin ? Groupes « * » et « fooder » seulement ;
 * la règle la plus longue gagne, « Allow » à égalité (convention des moteurs de recherche).
 */
export function robotsAllowed(text, pathAndQuery) {
  const rules = [];
  let applies = false;
  let inAgents = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(raw.replace(/#.*/, '').trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') {
      const mine = m[2].trim() === '*' || /fooder/i.test(m[2]);
      applies = inAgents ? applies || mine : mine;
      inAgents = true;
    } else {
      inAgents = false;
      if (applies && (key === 'disallow' || key === 'allow') && m[2].trim()) rules.push({ allow: key === 'allow', pattern: m[2].trim() });
    }
  }
  let best = null;
  for (const r of rules) {
    if (!ruleRegex(r.pattern).test(pathAndQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

/** Planificateur « 1 requête par seconde et par site » : renvoie le délai à attendre avant la prochaine requête vers `host`. */
export function createHostThrottle(minGapMs = 1000, now = () => Date.now()) {
  const next = new Map();
  return host => {
    const t = now();
    const at = Math.max(t, next.get(host) ?? 0);
    next.set(host, at + minGapMs);
    return at - t;
  };
}

/**
 * Images partagées entre plusieurs fiches (même empreinte). Entre restaurants de noms différents : suspect (visuel
 * de plateforme, d'agrégateur, de franchise mal attribuée) → écartée partout. Entre fiches du même nom (agences d'une
 * chaîne) : gardée, signalée « chain ». `items` : [{ key, id, hash }] ; `nameOf(id)` : clé de nom normalisée.
 * Retourne { dropped: Set<key>, chain: Set<key> }.
 */
export function sharedImages(items, nameOf, maxDist = MAX_HASH_DISTANCE) {
  const dropped = new Set();
  const chain = new Set();
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < items.length; j++) if (!seen.has(j) && hamming(items[i].hash, items[j].hash) <= maxDist) group.push(j);
    group.forEach(g => seen.add(g));
    const ids = new Set(group.map(g => items[g].id));
    if (ids.size < 2) continue;
    const names = new Set([...ids].map(nameOf));
    for (const g of group) (names.size > 1 ? dropped : chain).add(items[g].key);
  }
  return { dropped, chain };
}
