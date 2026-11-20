import data from '../data/quartiers-toulouse.json';

/**
 * Quartier d'un point par point-dans-polygone, avec les contours officiels des grands quartiers de Toulouse
 * (Mairie de Toulouse, Licence Ouverte v2.0 : voir docs/QUARTIERS.md). SERVEUR ET SCRIPTS SEULEMENT : les contours pèsent ~115 Ko
 * et ne doivent pas partir dans le navigateur. Le quartier d'une fiche est calculé à la construction des données
 * (scripts/verify-addresses.mjs, champ `q` de data/addresses-verified.json) puis servi avec la fiche (`Restaurant.quartier`).
 */
type Ring = readonly (readonly [number, number])[];
interface QuartierGeo {
  name: string;
  /** [latMin, lngMin, latMax, lngMax] : écarte vite les quartiers trop loin. */
  bbox: readonly [number, number, number, number];
  /** Premier anneau : contour ; les suivants : trous. [latitude, longitude]. */
  rings: readonly Ring[];
}

const GEO = data.quartiers as unknown as QuartierGeo[];

export const QUARTIER_SOURCE = { source: data.source, licence: data.licence, licenceUrl: data.licenceUrl, retrievedAt: data.retrievedAt } as const;

/** Lancer de rayon (règle pair-impair) : vrai si le point est dans le contour et pas dans un trou. */
export function pointInRings(lat: number, lng: number, rings: readonly Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Quartier officiel du point, ou null s'il est hors de Toulouse (Blagnac, Labège, Colomiers…) : rien n'est alors affiché. */
export function quartierAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const q of GEO) {
    const [latMin, lngMin, latMax, lngMax] = q.bbox;
    if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) continue;
    if (pointInRings(lat, lng, q.rings)) return q.name;
  }
  return null;
}

/** Noms des quartiers du fichier de contours (sert aux tests de cohérence avec lib/quartiers.ts). */
export const GEO_QUARTIER_NAMES: readonly string[] = GEO.map(q => q.name);
