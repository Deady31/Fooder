import { parseRefFromSearch } from './invite';
import { DUR, EASE } from './motion';

/* Logique pure de la coquille de l'app (entrée, navigation, transitions). */

export interface EntryDecision {
  destination: '/swipe' | '/onboarding';
  /** Code de parrainage valide à mémoriser, sinon null. */
  ref: string | null;
}

/** Où envoyer l'utilisateur arrivé sur « / » : inscrit → /swipe, sinon onboarding ; garde le ?ref=. */
export function decideEntry(p: { registered: boolean; search: string }): EntryDecision {
  return { destination: p.registered ? '/swipe' : '/onboarding', ref: parseRefFromSearch(p.search) };
}

/** Un onglet est actif sur son chemin exact ou un sous-chemin (jamais sur un simple préfixe de texte). */
export function isTabActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Index à focaliser après une flèche / Début / Fin dans la barre d'onglets ; null si la touche n'est pas gérée. */
export function tabIndexAfter(key: string, current: number, count: number): number | null {
  if (count <= 0 || current < 0 || current >= count) return null;
  switch (key) {
    case 'ArrowRight': return (current + 1) % count;
    case 'ArrowLeft': return (current + count - 1) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}

/** Texte du badge de favoris : masqué à 0, plafonné à 99+. */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? '99+' : String(Math.floor(count));
}

/** Écrans enfants (profondeur) : entrée latérale ; onglets frères : fondu seul. */
const CHILD_ROOTS = ['/amis', '/classement', '/groupe', '/defi', '/compte'];

function isChildScreen(pathname: string): boolean {
  if (CHILD_ROOTS.some(r => pathname === r || pathname.startsWith(`${r}/`))) return true;
  return pathname.split('/').filter(Boolean).length > 1;
}

export interface PageEntry {
  initial: { opacity: number; x?: number };
  animate: { opacity: number; x?: number };
  transition: { duration: number; ease?: readonly number[] };
}

/** Entrée de page : courte, sans saut vertical ; neutre si l'utilisateur réduit les mouvements. */
export function pageEntry(pathname: string | null | undefined, reduced: boolean | null | undefined): PageEntry {
  if (reduced) return { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } };
  if (pathname && isChildScreen(pathname)) {
    return {
      initial: { opacity: 0, x: 24 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: DUR.base, ease: EASE.out },
    };
  }
  return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.fast, ease: EASE.out } };
}

/** Pose / retire `data-hidden` (pause des animations infinies quand l'onglet est masqué). */
export function applyHidden(root: { toggleAttribute(name: string, force: boolean): unknown }, hidden: boolean): void {
  root.toggleAttribute('data-hidden', hidden);
}
