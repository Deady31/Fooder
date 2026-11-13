/**
 * Chargement du deck Découvrir : logique pure (ordre, distances, humeur, requête API) + appel API.
 * Aucune fonction ici n'attend la géolocalisation : la pile se construit avec l'origine connue
 * (dernière position ou Capitole) et se réordonne ensuite (voir lib/deckStore.reorderUpcoming).
 */
import type { Restaurant } from '../data/mockRestaurants';
import { communityPhotosFor } from './communityPhotos';
import { haversine } from './geo';
import { distanceLabel } from './geo/format';
import { roundCoord, type Coords, type PositionSource } from './geo/position';
import { type CommunityPhoto, mergeCommunityPhotos, withBetterPhoto } from './photoPriority';
import { rankRichFirst } from './ranking';
import type { Deck } from './deckStore';

/** L'API renvoie toute la métropole triée par distance ; le rayon choisi filtre côté client. */
export const API_RADIUS_M = 20_000;
export const PAGE_SIZE = 50;

export const MOOD_FILTERS: Record<string, RegExp | null> = {
  surprise: null,
  asie: /asi|jap|sushi|ramen|thai|chin|vietn|n[ée]pal|indi/i,
  terroir: /fran[cç]|bistro|terroir|gastro|cassoulet/i,
  street: /burger|kebab|kabab|taco|street|fast|pizza|turc/i,
  veggie: /veg|végé|vert|sain|salad|bio/i,
  gros: /burger|pizza|kebab|kabab|grill|steak/i,
  special: /gastro|romant|[ée]toil/i,
  brunch: /brunch|caf[eé]|boulang|bagel|bakery/i,
};

export function matchesMood(r: Restaurant, moodId: string): boolean {
  const re = MOOD_FILTERS[moodId];
  if (!re) return true;
  return re.test(`${r.cuisine} ${r.name} ${r.description}`);
}

/** Restos de l'humeur ; s'il n'y en a aucun, toute la liste (jamais de pile vide par l'humeur seule). */
export function moodPool(list: readonly Restaurant[], moodId: string): Restaurant[] {
  const matched = list.filter(r => matchesMood(r, moodId));
  return matched.length > 0 ? matched : [...list];
}

/** Ids déjà likés ou écartés, à partir des listes brutes du stockage (lecture défensive). */
export function seenIdsFrom(lists: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

/** Paramètres de /api/restaurants : coordonnées arrondies à 3 décimales (~100 m) au plus. */
export function buildApiQuery(origin: Coords | null, offset: number): string {
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE), radius: String(API_RADIUS_M), offset: String(offset) });
  if (origin) {
    qs.set('lat', String(roundCoord(origin.lat, 3)));
    qs.set('lng', String(roundCoord(origin.lng, 3)));
  }
  return qs.toString();
}

export function parseApiPage(json: unknown): { items: Restaurant[]; total: number } | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as { success?: unknown; data?: unknown; meta?: { total?: unknown } };
  if (j.success !== true || !Array.isArray(j.data)) return null;
  const total = typeof j.meta?.total === 'number' ? j.meta.total : j.data.length;
  return { items: j.data as Restaurant[], total };
}

export async function fetchApiPage(origin: Coords | null, offset: number): Promise<{ items: Restaurant[]; total: number } | null> {
  try {
    const res = await fetch(`/api/restaurants?${buildApiQuery(origin, offset)}`);
    return parseApiPage(await res.json());
  } catch {
    return null;
  }
}

/** Distances réelles (haversine) depuis l'origine ; libellé honnête si l'origine est le centre par défaut. */
export function withDistances(list: readonly Restaurant[], origin: Coords, source: PositionSource): Restaurant[] {
  return list.map(r => {
    if (r.lat === undefined || r.lng === undefined) return { ...r, distance: '', distanceMeters: undefined };
    const d = haversine(origin.lat, origin.lng, r.lat, r.lng);
    return { ...r, distanceMeters: Math.round(d), distance: distanceLabel(d, source) };
  });
}

export function sortWithSponsored(list: readonly Restaurant[]): Restaurant[] {
  return [...list.filter(r => r.sponsored), ...list.filter(r => !r.sponsored)];
}

/** Ordre du deck : sponsorisés, puis fiches riches, chaque groupe trié par distance (coordonnées inconnues en dernier). */
export function orderDeck(list: readonly Restaurant[], origin: Coords): Restaurant[] {
  const dist = (r: Restaurant) => (r.lat === undefined || r.lng === undefined ? Infinity : haversine(origin.lat, origin.lng, r.lat, r.lng));
  const byDistance = list.map(r => ({ r, d: dist(r) })).sort((a, b) => a.d - b.d).map(x => x.r);
  return sortWithSponsored(rankRichFirst(byDistance));
}

/** Photo de la communauté locale (posts de l'appareil) : synchrone, sans réseau. */
export function withLocalCommunity(list: readonly Restaurant[]): Restaurant[] {
  return list.map(r => withBetterPhoto(r, { source: 'community', images: mergeCommunityPhotos(communityPhotosFor(r.id), []) }));
}

/** Photos de la communauté en ligne, fusionnées après coup sans toucher aux cartes épinglées (déjà visibles). */
export function withCloudCommunity(list: readonly Restaurant[], cloud: Map<string, CommunityPhoto[]>, skip: ReadonlySet<string>): Restaurant[] {
  if (cloud.size === 0) return [...list];
  return list.map(r => {
    const photos = cloud.get(r.id);
    if (!photos?.length || skip.has(r.id)) return r;
    return withBetterPhoto(r, { source: 'community', images: mergeCommunityPhotos(communityPhotosFor(r.id), photos) });
  });
}

export interface InitialDeckInput {
  mock: readonly Restaurant[];
  api: readonly Restaurant[];
  seen: ReadonlySet<string>;
  moodId: string;
  origin: Coords;
  source: PositionSource;
  /** Toutes les cartes ont déjà été vues : les reproposer (défaut) plutôt qu'une pile vide. */
  fallbackToSeen?: boolean;
}

/** Fusion (fiches soignées + API sans doublon de nom), cartes déjà vues retirées, humeur, distances, ordre. */
export function initialCandidates({ mock, api, seen, origin, source, fallbackToSeen = true }: Omit<InitialDeckInput, 'moodId'>): Restaurant[] {
  const known = new Set(mock.map(r => r.name.toLowerCase()));
  const candidates = [...mock, ...api.filter(r => !known.has(r.name.toLowerCase()))];
  const unseen = candidates.filter(r => !seen.has(r.id));
  return orderDeck(withDistances(unseen.length > 0 || !fallbackToSeen ? unseen : candidates, origin, source), origin);
}

/** Pile prête à afficher, construite sans réseau ni GPS (la première carte est immédiate). */
export function initialDeck(input: InitialDeckInput): Deck {
  const pool = moodPool(initialCandidates(input), input.moodId);
  return { list: [...pool].reverse(), index: pool.length - 1 };
}
