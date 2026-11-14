import { FeedPost } from '../../lib/feed';
import { isDemoPost } from './feedLogic';
import { filterPosts, foldText } from './reviewSearch';

/** Filtres du Fil (Tous · Amis · Moi, restaurant) : logique pure, testée dans tests/feedFilters.test.ts. */

export type FeedScope = 'tous' | 'amis' | 'moi';
export interface FeedFilters {
  scope: FeedScope;
  /** Id du restaurant, ou null pour tous. */
  resto: string | null;
}

export const DEFAULT_FILTERS: FeedFilters = { scope: 'tous', resto: null };
export const FILTERS_KEY = 'fooder_feed_filters';

export const SCOPES: { id: FeedScope; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'amis', label: 'Amis' },
  { id: 'moi', label: 'Moi' },
];

const RESTO_ID = /^[A-Za-z0-9._:-]{1,60}$/;
const USER_ID = /^[0-9a-f]{32}$/;

const parseScope = (raw: unknown): FeedScope => (raw === 'amis' || raw === 'moi' ? raw : 'tous');
const parseResto = (raw: unknown): string | null => (typeof raw === 'string' && RESTO_ID.test(raw) ? raw : null);

/** Identifiant de compte normalisé (UUID avec ou sans tirets → 32 hexadécimaux) ; null si invalide. */
export function normalizeUserId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.replace(/-/g, '').toLowerCase();
  return USER_ID.test(id) ? id : null;
}

export const hasActiveFilters = (f: FeedFilters): boolean => f.scope !== 'tous' || f.resto !== null;

/** Lit `?scope=…&resto=…` (valeurs inconnues ignorées : l'URL n'est pas fiable). */
export function parseFilters(params: { get(name: string): string | null } | null | undefined): FeedFilters {
  if (!params) return DEFAULT_FILTERS;
  return { scope: parseScope(params.get('scope')), resto: parseResto(params.get('resto')) };
}

export function parseStoredFilters(raw: unknown): FeedFilters {
  if (!raw || typeof raw !== 'object') return DEFAULT_FILTERS;
  const { scope, resto } = raw as { scope?: unknown; resto?: unknown };
  return { scope: parseScope(scope), resto: parseResto(resto) };
}

/** « scope=amis&resto=osm-n1 » ; chaîne vide si rien n'est actif. */
export function filtersToQuery(f: FeedFilters): string {
  const parts: string[] = [];
  if (f.scope !== 'tous') parts.push(`scope=${f.scope}`);
  if (f.resto) parts.push(`resto=${encodeURIComponent(f.resto)}`);
  return parts.join('&');
}

/** Le post est d'un de mes amis (auteur connu, ni moi ni un exemple). */
export function isFriendPost(p: Pick<FeedPost, 'id' | 'authorId' | 'mine'>, friendIds: ReadonlySet<string>): boolean {
  if (p.mine || isDemoPost(p)) return false;
  const id = normalizeUserId(p.authorId);
  return id !== null && friendIds.has(id);
}

export function filterByScope(posts: readonly FeedPost[], scope: FeedScope, friendIds: ReadonlySet<string>): FeedPost[] {
  if (!Array.isArray(posts)) return [];
  if (scope === 'amis') return posts.filter(p => isFriendPost(p, friendIds));
  if (scope === 'moi') return posts.filter(p => p.mine === true);
  return [...posts];
}

export function filterByResto(posts: readonly FeedPost[], resto: string | null): FeedPost[] {
  if (!Array.isArray(posts)) return [];
  return resto ? posts.filter(p => p.restaurantId === resto) : [...posts];
}

export interface FeedView {
  query: string;
  filters: FeedFilters;
  friendIds: ReadonlySet<string>;
}

/** Portée, puis restaurant, puis recherche d'avis. Dès qu'un filtre ou une recherche est actif, les exemples fictifs sont écartés. */
export function applyFeedFilters(posts: readonly FeedPost[], { query, filters, friendIds }: FeedView): FeedPost[] {
  const narrowed = filterByResto(filterByScope(posts, filters.scope, friendIds), filters.resto);
  const active = hasActiveFilters(filters) || foldText(query) !== '';
  // filterPosts n'écarte les exemples que pour une requête non vide : on le fait ici pour les filtres seuls.
  return filterPosts(active ? narrowed.filter(p => !isDemoPost(p)) : narrowed, query, { excludeDemo: active });
}

export interface RestaurantOption {
  id: string;
  name: string;
  cuisine: string;
  count: number;
}

/** Garde les restos dont le nom ou la cuisine contient chaque mot cherché (accents et casse ignorés). */
export function filterOptions(options: readonly RestaurantOption[], search: string): RestaurantOption[] {
  const tokens = foldText(search).split(/\s+/).filter(Boolean);
  return options.filter(o => {
    const h = foldText(`${o.name} ${o.cuisine}`);
    return tokens.every(t => h.includes(t));
  });
}

/** Restaurants qui ont au moins un vrai post : le plus commenté d'abord, puis A→Z. `search` ignore accents et casse. */
export function restaurantOptions(posts: readonly FeedPost[], search = ''): RestaurantOption[] {
  if (!Array.isArray(posts)) return [];
  const byId = new Map<string, RestaurantOption>();
  for (const p of posts) {
    if (isDemoPost(p) || !p.restaurantId) continue;
    const known = byId.get(p.restaurantId);
    if (known) known.count += 1;
    else byId.set(p.restaurantId, { id: p.restaurantId, name: p.restaurantName, cuisine: p.cuisine, count: 1 });
  }
  return filterOptions(Array.from(byId.values()), search).sort(
    (a, b) => b.count - a.count || foldText(a.name).localeCompare(foldText(b.name), 'fr')
  );
}
