/**
 * Constantes de mouvement partagées (Framer Motion).
 * Valeurs alignées sur SwipeDeck (ressort 290/28, ease-out-expo) et sur les
 * feuilles existantes (≈ 260/26).
 */

/** Ressorts : souple (feuilles, entrées), vive (cartes), ferme (onglets, retours nets). */
export const SPRING = {
  soft: { type: 'spring' as const, stiffness: 260, damping: 26 },
  lively: { type: 'spring' as const, stiffness: 290, damping: 28, mass: 0.9 },
  firm: { type: 'spring' as const, stiffness: 420, damping: 32 },
} as const;

/** Courbes de Bézier cubiques. */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
} as const;

/** Durées en secondes. */
export const DUR = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/**
 * Neutralise une transition quand l'utilisateur demande moins de mouvement
 * (`useReducedMotion()` de framer-motion). `null`/`undefined`/`false` : inchangée.
 */
export function reducedMotion<T>(transition: T, reduced: boolean | null | undefined): T | { duration: 0 } {
  return reduced ? { duration: 0 } : transition;
}
