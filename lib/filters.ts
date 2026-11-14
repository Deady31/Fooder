import type { Diet, Restaurant } from '../data/mockRestaurants';
import { matchesDiets } from './diets';
import { haversine } from './geo';
import { formatReopening, nextOpening, openStatus, parisWallClock, type NextOpening, type OpenStatus } from './openingHours';

/** Régimes proposés en puces (sans gluten : trop peu de données, badge seulement). */
export const FILTER_DIETS: readonly Diet[] = ['vegetarian', 'vegan', 'halal'];

export interface FilterOptions {
  /** « Ouvert (confirmé) » : ouverture certaine uniquement (horaires inconnus exclus). */
  openNow: boolean;
  /** Retire les restos fermés (défaut true). Les horaires inconnus restent. */
  hideClosed?: boolean;
  diets: Diet[];
  now: Date;
  /** Position de référence (vraie position, adresse saisie ou centre par défaut). */
  origin?: { lat: number; lng: number } | null;
  /** Rayon en mètres ; null ou absent = toute la métropole. */
  radiusM?: number | null;
  /** Budget max en euros ; null ou absent = sans limite. Les prix inconnus (0) passent. */
  maxPrice?: number | null;
  /** Cuisine exacte ; null ou absent = toutes. */
  cuisine?: string | null;
}

function withinRadius(r: Restaurant, origin: FilterOptions['origin'], radiusM: FilterOptions['radiusM']): boolean {
  if (!origin || radiusM === null || radiusM === undefined) return true;
  if (r.lat === undefined || r.lng === undefined) return false;
  return haversine(origin.lat, origin.lng, r.lat, r.lng) <= radiusM;
}

/** Rang d'affichage : ouvert ou inconnu d'abord, puis « bientôt fermé », puis fermé. */
const RANK: Record<OpenStatus, number> = { open: 0, unknown: 0, 'closing-soon': 1, closed: 2 };

/**
 * Filtres non destructifs (la liste d'entrée n'est jamais modifiée) :
 * - fermés : retirés par défaut (`hideClosed`), horaires inconnus gardés ; l'heure est celle de Paris ;
 * - ordre : la première carte est la première de la liste ; ordre conservé, sauf « bientôt fermé »
 *   (moins de 30 min) puis fermés repoussés à la fin ;
 * - « Ouvert (confirmé) » : ouverture certaine uniquement (horaires inconnus = exclus) ;
 * - régimes : ET logique, fiches sans info exclues ;
 * - rayon : distance à vol d'oiseau depuis `origin`, fiches sans coordonnées exclues ;
 * - budget : prix connu au-dessus du maximum exclu ; cuisine : égalité stricte.
 */
export function applyFilters(restaurants: readonly Restaurant[], opts: FilterOptions): Restaurant[] {
  const { openNow, diets, now, origin, radiusM, maxPrice, cuisine, hideClosed = true } = opts;
  const wall = parisWallClock(now);
  const ranked: { r: Restaurant; rank: number }[] = [];
  for (const r of restaurants) {
    const status = openStatus(r.hours, wall);
    if (hideClosed && status === 'closed') continue;
    if (openNow && (status === 'unknown' || status === 'closed')) continue;
    if (!matchesDiets(r, diets) || !withinRadius(r, origin, radiusM)) continue;
    if (maxPrice !== null && maxPrice !== undefined && r.price > 0 && r.price > maxPrice) continue;
    if (cuisine && r.cuisine !== cuisine) continue;
    ranked.push({ r, rank: RANK[status] });
  }
  // Tri stable : l'ordre d'origine est conservé à rang égal.
  return [0, 1, 2].flatMap(rank => ranked.filter(x => x.rank === rank).map(x => x.r));
}

/**
 * Ordre de pile (la dernière carte est celle du dessus) : « bientôt fermé » puis fermés tout en bas,
 * le reste dans l'ordre. Les cartes de `keep` (celle du dessus, jamais déplacée) ne bougent pas de groupe.
 */
export function sinkClosed(stack: readonly Restaurant[], now: Date, keep: ReadonlySet<string>): Restaurant[] {
  const wall = parisWallClock(now);
  const rank = (r: Restaurant) => (keep.has(r.id) ? 0 : RANK[openStatus(r.hours, wall)]);
  return [2, 1, 0].flatMap(k => stack.filter(r => rank(r) === k));
}

/** Statut d'ouverture d'un resto à l'instant `now` (heure de Paris). */
export function statusAt(r: Pick<Restaurant, 'hours'>, now: Date): OpenStatus {
  return openStatus(r.hours, parisWallClock(now));
}

/** Le resto qui rouvre le plus tôt parmi ceux fermés (horaires connus), ou null. */
export function earliestReopening(restaurants: readonly Restaurant[], now: Date): { rest: Restaurant; opening: NextOpening } | null {
  const wall = parisWallClock(now);
  let best: { rest: Restaurant; opening: NextOpening } | null = null;
  for (const rest of restaurants) {
    const opening = nextOpening(rest.hours, wall);
    if (opening && (!best || opening.minutes < best.opening.minutes)) best = { rest, opening };
  }
  return best;
}

/** « Réouverture à 11 h 30 : Chez X » (null si aucun horaire connu). */
export function reopeningLine(restaurants: readonly Restaurant[], now: Date): string | null {
  const found = earliestReopening(restaurants, now);
  return found ? `Réouverture ${formatReopening(found.opening, parisWallClock(now))} : ${found.rest.name}` : null;
}

export function toggleDiet(current: readonly Diet[], diet: Diet): Diet[] {
  return current.includes(diet) ? current.filter(d => d !== diet) : [...current, diet];
}

/** Lit défensivement le JSON brut de `fooder_profile` et renvoie les régimes filtrables (vegan/vegetarian/halal). */
export function dietsFromProfile(raw: string | null): Diet[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = parsed && typeof parsed === 'object' ? (parsed as { diets?: unknown }).diets : undefined;
    if (!Array.isArray(list)) return [];
    const valid = list.filter((d): d is Diet => typeof d === 'string' && FILTER_DIETS.includes(d as Diet));
    return Array.from(new Set(valid));
  } catch {
    return [];
  }
}

export type BlockingFilter = 'radius' | 'closed' | 'diets' | 'openNow' | 'price';

/**
 * Filtre à relâcher quand il ne reste aucune carte : le rayon s'il suffit, puis « tout est fermé »
 * (des restos correspondent mais sont fermés), le régime, « ouvert (confirmé) », et enfin budget/cuisine.
 */
export function blockingFilter(restaurants: readonly Restaurant[], opts: FilterOptions): BlockingFilter {
  const passes = (o: FilterOptions) => applyFilters(restaurants, o).length > 0;
  if (opts.radiusM !== null && opts.radiusM !== undefined && passes({ ...opts, radiusM: null })) return 'radius';
  if (opts.hideClosed !== false && passes({ ...opts, hideClosed: false })) return 'closed';
  if (opts.diets.length > 0 && passes({ ...opts, diets: [] })) return 'diets';
  if (opts.openNow && passes({ ...opts, openNow: false })) return 'openNow';
  if (opts.diets.length > 0) return 'diets';
  if (opts.openNow) return 'openNow';
  return opts.maxPrice != null || opts.cuisine ? 'price' : 'radius';
}
