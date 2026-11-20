// Fonctions pures de l'audit des adresses (testées dans tests/addressAudit.test.ts). Aucun accès réseau ni disque.

/** Texte sans accents ni majuscules. */
export const fold = s =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const STOP = new Set(['restaurant', 'le', 'la', 'les', 'l', 'chez', 'bar', 'cafe', 'brasserie', 'pizzeria', 'de', 'du', 'des', 'et', 'au', 'aux', 'a']);

/** Clé de comparaison de noms : mêmes règles que scripts/build-places.mjs (sans accents, sans mots vides). */
export const nameKey = s =>
  fold(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w))
    .join('');

/** Distance approchée en mètres entre deux points { la, ln } (suffisant à l'échelle d'une ville). */
export const meters = (a, b) => {
  const dy = (a.la - b.la) * 111_000;
  const dx = (a.ln - b.ln) * 111_000 * Math.cos((a.la * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

/** Deux fiches désignent le même lieu : noms compatibles et moins de 70 m (règle de build-places). */
export function sameVenue(a, b) {
  if (meters(a, b) > 70) return false;
  const ka = nameKey(a.n);
  const kb = nameKey(b.n);
  if (!ka || !kb) return false;
  return ka === kb || (Math.min(ka.length, kb.length) >= 4 && (ka.includes(kb) || kb.includes(ka)));
}

const STREET_WORD = /^(rue|avenue|av\.?|bd|boulevard|route|rte|chemin|chem\.?|place|all[ée]e|impasse|quai|cours|passage|square|zone|rond|cit[ée]|r[ée]sidence|centre|lieu|parc|port|ZAC|zi)\b/i;

/**
 * Lit une adresse « 269 La Méridienne, 31670, Labège » : présente ? numéro de rue ? code postal ? commune ?
 * Le numéro est celui d'un segment qui commence par 1 à 4 chiffres (un code postal à 5 chiffres n'en est pas un).
 */
export function parseAddress(raw) {
  const s = (raw ?? '').trim();
  if (!s) return { present: false, hasNumber: false, postcode: null, commune: null };
  const segments = s.split(',').map(x => x.trim()).filter(Boolean);
  const hasNumber = segments.some(seg => /^\d{1,4}(?:\s?[/-]\s?\d{1,4})?(?!\d)\s?(bis|ter|quater|[a-d])?(\s|$)/i.test(seg));
  const pc = s.match(/\b(\d{5})\b/);
  const postcode = pc ? pc[1] : null;
  let commune = null;
  if (postcode) {
    const after = s.slice(s.indexOf(postcode) + 5).replace(/^[\s,]+/, '').trim();
    commune = after || null;
  } else if (segments.length > 1) {
    const last = segments[segments.length - 1];
    if (!/\d/.test(last) && !STREET_WORD.test(last)) commune = last;
  }
  return { present: true, hasNumber, postcode, commune };
}

/** Problèmes d'une adresse : `sans_adresse`, sinon une liste parmi `sans_numero`, `sans_code_postal`, `sans_commune`. */
export function addressIssues(raw) {
  const p = parseAddress(raw);
  if (!p.present) return ['sans_adresse'];
  const out = [];
  if (!p.hasNumber) out.push('sans_numero');
  if (!p.postcode) out.push('sans_code_postal');
  if (!p.commune) out.push('sans_commune');
  return out;
}

/** Numéros de rue de la première voie numérotée (« 13/14 » donne [13, 14]), ou null. */
function streetNumbers(raw) {
  for (const seg of (raw ?? '').split(',').map(x => x.trim())) {
    const m = seg.match(/^(\d{1,4})(?:\s?[/-]\s?(\d{1,4}))?(?!\d)/);
    if (m) return [Number(m[1]), ...(m[2] ? [Number(m[2])] : [])];
  }
  return null;
}

/** Cohérence entre l'adresse OSM et celle d'Overture pour un même lieu : 'incomplet' si l'une manque, sinon 'ok' ou un conflit. */
export function coherence(osmAddr, ovtAddr) {
  if (!parseAddress(osmAddr).present || !parseAddress(ovtAddr).present) return 'incomplet';
  const a = parseAddress(osmAddr);
  const b = parseAddress(ovtAddr);
  if (a.postcode && b.postcode && a.postcode !== b.postcode) return 'conflit_code_postal';
  const na = streetNumbers(osmAddr);
  const nb = streetNumbers(ovtAddr);
  if (na && nb && !na.some(n => nb.includes(n))) return 'conflit_numero';
  return 'ok';
}

/**
 * Regroupe les fiches de même nom normalisé.
 *  - `duplicates` : groupes d'au moins 2 fiches à `threshold` mètres ou moins les unes des autres (à fusionner) ;
 *  - `chains` : noms présents en plusieurs endroits distincts (au moins 2 agences à plus de `threshold` m) ; chaque agence doit avoir sa propre adresse.
 */
export function clusterByName(records, threshold = 50) {
  const byKey = new Map();
  for (const r of records) {
    const k = nameKey(r.n);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  const duplicates = [];
  const chains = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    // Composantes connexes : deux fiches sont liées si elles sont à `threshold` m ou moins.
    const parent = group.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (meters(group[i], group[j]) <= threshold) parent[find(i)] = find(j);
      }
    }
    const comps = new Map();
    group.forEach((r, i) => {
      const root = find(i);
      if (!comps.has(root)) comps.set(root, []);
      comps.get(root).push(r.id);
    });
    const clusters = [...comps.values()];
    for (const c of clusters) if (c.length >= 2) duplicates.push({ key, ids: c });
    if (clusters.length >= 2) chains.push({ key, agencies: clusters.length, ids: group.map(r => r.id) });
  }
  return { duplicates, chains };
}
