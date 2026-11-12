import { closesAt, formatCloseTime, isOpenAt } from './openingHours';
import { OsmRecord, cuisineLabel } from './osm';

// Ids des fiches : « osm-n123 », « osm-w1 », « ovt-<uuid> ». Rien d'autre n'est accepté.
const ID_RE = /^(osm|ovt)-[a-z0-9-]{1,64}$/;

/** Recherche exacte par id ; toute valeur mal formée ou inconnue donne null. */
export function findPlaceById(records: readonly OsmRecord[], id: string | undefined | null): OsmRecord | null {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  return records.find(r => r.id === id) ?? null;
}

/** Préréglage du formulaire « vraie photo » : nom et cuisine viennent des données, jamais de l'URL. */
export function resolvePhotoPreset(
  records: readonly OsmRecord[],
  id: string | undefined | null,
): { id: string; name: string; cuisine: string } | null {
  const rec = findPlaceById(records, id);
  return rec ? { id: rec.id, name: rec.n, cuisine: cuisineLabel(rec) } : null;
}

/** Seules les fiches OSM/Overture ont une page publique. */
export function isSharable(id: string): boolean {
  return ID_RE.test(id);
}

export function restoPath(id: string): string {
  return `/resto/${encodeURIComponent(id)}`;
}

export function restoUrl(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, '')}${restoPath(id)}`;
}

export function shareText(name: string, cuisine: string): string {
  return `${name} (${cuisine}) à Toulouse, vu sur Fooder`;
}

export function hoursSummary(raw: string | undefined | null, now: Date): string {
  const open = isOpenAt(raw, now);
  if (open === null) return 'Horaires non communiqués';
  if (!open) return 'Fermé pour le moment';
  const close = closesAt(raw, now);
  return close ? `Ouvert, ferme à ${formatCloseTime(close)}` : 'Ouvert';
}
