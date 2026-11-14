/**
 * Heuristiques de qualité des photos de sites (partagées par filter-photos.mjs et build-consented-photos.mjs).
 * Elles repèrent des VISUELS DE MARQUE probables (logo, bannière, menu, capture, façade) ; elles ne savent PAS
 * reconnaître un plat. Voir docs/PHOTOS.md.
 */

/** Mots (dans le nom de fichier / chemin de l'image) qui trahissent un visuel qui n'est pas un plat. */
export const BAD_NAME_TOKENS = new Set([
  'logo', 'logos', 'banner', 'banners', 'banniere', 'bandeau', 'favicon', 'icon', 'icons', 'icone', 'sprite',
  'header', 'placeholder', 'avatar', 'screenshot', 'screenshots', 'capture', 'flyer', 'affiche', 'menu', 'menus',
  'carte', 'cartes', 'qr', 'picto', 'badge', 'map', 'casino', 'slot', 'gacor', 'toto', 'poker',
  'facade', 'devanture', 'exterieur', 'exterior', 'storefront', 'vitrine',
]);

const tokens = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Mot suspect dans le chemin de l'image (hors domaine), ou null. */
export function badNameToken(imageUrl) {
  let path = '';
  try {
    path = decodeURIComponent(new URL(imageUrl).pathname);
  } catch {
    path = String(imageUrl ?? '');
  }
  return tokens(path).find((t) => BAD_NAME_TOKENS.has(t)) ?? null;
}

/**
 * Raisons pour lesquelles une photo est écartée (tableau vide = gardée).
 * @param stat  ligne de data/photo-stats.json { colors, top, mean, std, ratio }
 * @param entry ligne de data/restaurant-photos.json { image, bytes, type }
 */
export function qualityReasons(stat, entry = {}) {
  const out = [];
  if (stat) {
    if (stat.ratio > 2.2 || stat.ratio < 0.6) out.push('ratio extrême');
    if (stat.colors < 45) out.push('logo/aplat');
    else if (stat.colors < 80 && stat.top > 0.4) out.push('peu de couleurs');
    if (stat.top > 0.6) out.push('uniforme');
    if (stat.mean > 235 && stat.std < 12) out.push('blanc');
    if (stat.mean < 14) out.push('noir');
    if (entry.type === 'image/png' && stat.colors < 110) out.push('graphique png');
  }
  if (entry.bytes && entry.bytes < 28000) out.push('poids faible');
  const t = badNameToken(entry.image);
  if (t) out.push(`nom « ${t} »`);
  return out;
}
