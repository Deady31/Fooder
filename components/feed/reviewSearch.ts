import { FeedPost, VERDICTS } from '../../lib/feed';
import { isDemoPost } from './feedLogic';

/** Recherche d'avis dans le Fil : logique pure (testée dans tests/reviewSearch.test.ts). */

export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_QUERY = 60;

/** Minuscules sans accents, espaces rognés : « Café ÉCLAIR » → « cafe eclair ». */
export function foldText(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const verdictLabel = (id: string): string => VERDICTS.find(v => v.id === id)?.label ?? id;

/** Texte consultable d'un post : resto, cuisine, avis, auteur, verdict. */
function haystack(p: FeedPost): string {
  const author = p.mine ? 'toi' : (p.author?.name ?? '');
  return foldText([p.restaurantName, p.cuisine, p.caption, author, verdictLabel(p.verdict)].filter(Boolean).join(' '));
}

/**
 * Filtre les posts : chaque mot de la requête doit apparaître (accents et casse ignorés, nom partiel accepté).
 * Requête vide : tout est renvoyé. `excludeDemo` retire les exemples fictifs (jamais de faux avis dans une recherche).
 */
export function filterPosts(posts: readonly FeedPost[], query: string, opts: { excludeDemo?: boolean } = {}): FeedPost[] {
  if (!Array.isArray(posts)) return [];
  const tokens = foldText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...posts];
  return posts.filter(p => {
    if (opts.excludeDemo && isDemoPost(p)) return false;
    const h = haystack(p);
    return tokens.every(t => h.includes(t));
  });
}

/** Nettoie le paramètre `q` d'une URL : sans caractères de contrôle, plafonné. */
export function parseQueryParam(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_QUERY);
}

/** Lien vers le fil pré-filtré sur un restaurant (à brancher depuis la fiche du resto). */
export function reviewsHref(_restaurantId: string, name: string): string {
  const q = parseQueryParam(name);
  return q ? `/feed?q=${encodeURIComponent(q)}` : '/feed';
}

export type SearchView = 'idle' | 'loading' | 'results' | 'empty';

/** État de l'écran : `typed` = champ, `settled` = valeur après le délai de frappe. */
export function searchView(s: { typed: string; settled: string; resultCount: number }): SearchView {
  const typed = s.typed.trim();
  if (!typed) return 'idle';
  if (typed !== s.settled.trim()) return 'loading';
  return s.resultCount > 0 ? 'results' : 'empty';
}

export interface Debouncer<T> {
  call: (value: T) => void;
  /** Déclenche tout de suite (annule l'attente). */
  flush: (value: T) => void;
  cancel: () => void;
}

export function createDebouncer<T>(fn: (value: T) => void, ms: number = SEARCH_DEBOUNCE_MS): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    call: value => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fn(value);
      }, ms);
    },
    flush: value => {
      cancel();
      fn(value);
    },
    cancel,
  };
}
