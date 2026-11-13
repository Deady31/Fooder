import { FeedAuthor, FeedPost } from '../../lib/feed';
import { stickerFor } from '../../lib/stickers';
import type { Visit } from '../../lib/visits';

/** Logique pure du Fil (aucune dépendance au DOM ni à React) : testée dans tests/feedLogic.test.ts. */

export const VISIT_PREFIX = 'visit-';
export const SEED_PREFIX = 'seed-';

/** Ids des posts publiés en ligne (UUID). */
const CLOUD_POST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mes éléments récents passent devant le fil de la ville pendant cette durée. */
export const PIN_WINDOW_MS = 7 * 24 * 3_600_000;
/** Un post du même resto publié dans cette fenêtre autour de la visite « porte » déjà cette visite. */
const SAME_VISIT_WINDOW_MS = 12 * 3_600_000;

export const isDemoPost = (p: Pick<FeedPost, 'id'>): boolean => p.id.startsWith(SEED_PREFIX);
export const isVisitPost = (p: Pick<FeedPost, 'id'>): boolean => p.id.startsWith(VISIT_PREFIX);
export const isCloudPostId = (id: string): boolean => CLOUD_POST_ID.test(id);

/**
 * Nombre de « miam » affiché.
 * `likes` d'un post en ligne vient du serveur et contient déjà mon cœur s'il existait au chargement (`likedAtLoad`) :
 * on retire ce cœur puis on ajoute l'état courant, pour ne jamais compter +1 en trop.
 * Pour un post local ou de démo, `likedAtLoad` vaut false : le cœur s'ajoute simplement.
 */
export function miamCount(likes: number, liked: boolean, likedAtLoad: boolean): number {
  const base = Number.isFinite(likes) ? Math.max(0, Math.trunc(likes)) : 0;
  return Math.max(0, base - (likedAtLoad ? 1 : 0) + (liked ? 1 : 0));
}

/** Une visite confirmée vue comme un post du Fil (sans photo : la photo, si elle existe, est portée par le post). */
export function visitToPost(v: Visit, me: FeedAuthor): FeedPost {
  return {
    id: `${VISIT_PREFIX}${v.restId}-${v.at}`,
    author: me,
    restaurantId: v.restId,
    restaurantName: v.name,
    cuisine: v.cuisine,
    sticker: stickerFor(v.cuisine, v.restId, v.name),
    caption: '',
    verdict: v.verdict,
    likes: 0,
    createdAt: v.at,
    mine: true,
  };
}

export interface BuildFeedInput {
  remote: FeedPost[];
  mine: FeedPost[];
  visits: Visit[];
  seeds: FeedPost[];
  me: FeedAuthor;
  now?: number;
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Compose le Fil : posts en ligne + mes posts + mes visites confirmées (sans doublon avec un post du même resto).
 * Les exemples de démo ne sont présents que s'il n'y a AUCUNE donnée réelle.
 * Mes éléments des 7 derniers jours passent en tête ; le reste est trié du plus récent au plus ancien.
 */
export function buildFeed(input: BuildFeedInput): FeedPost[] {
  const now = input.now ?? Date.now();
  const remote = asArray<FeedPost>(input.remote);
  const mine = asArray<FeedPost>(input.mine);
  const visits = asArray<Visit>(input.visits);

  const remoteIds = new Set(remote.map(p => p.id));
  const local = mine.filter(p => !remoteIds.has(p.id));
  const owned = [...remote.filter(p => p.mine), ...local];

  const visitPosts = visits
    .filter(v => !owned.some(p => p.restaurantId === v.restId && Math.abs(p.createdAt - v.at) < SAME_VISIT_WINDOW_MS))
    .map(v => visitToPost(v, input.me));

  const real = [...remote, ...local, ...visitPosts];
  const all = real.length > 0 ? real : asArray<FeedPost>(input.seeds);
  const pinned = (p: FeedPost): number => (p.mine && now - p.createdAt < PIN_WINDOW_MS ? 1 : 0);
  return [...all].sort((a, b) => pinned(b) - pinned(a) || b.createdAt - a.createdAt);
}

export interface PublishLock {
  /** Exécute `action` une seule fois tant que le verrou n'est pas relâché. Renvoie false si déjà verrouillé. */
  run: (action: () => boolean) => boolean;
  reset: () => void;
}

/**
 * Verrou synchrone anti double appui : le second tap arrive avant tout re-rendu, un `useState` ne suffit pas.
 * Reste verrouillé après un succès (la feuille se ferme) ; se relâche si l'action échoue ou lève une erreur.
 */
export function createPublishLock(): PublishLock {
  let locked = false;
  return {
    run: action => {
      if (locked) return false;
      locked = true;
      try {
        const ok = action();
        if (!ok) locked = false;
        return true;
      } catch (e) {
        locked = false;
        throw e;
      }
    },
    reset: () => {
      locked = false;
    },
  };
}

export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter(p => p.id !== id);
}
