/**
 * Géométrie du tour : où poser la bulle autour de la zone éclairée, et comment tracer la flèche « à la main ».
 * Fonctions pures (testées) : aucun accès au DOM.
 */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export type BubbleSide = 'above' | 'below' | 'center';

export interface BubblePlacement {
  side: BubbleSide;
  left: number;
  top: number;
}

const bottom = (r: Rect): number => r.top + r.height;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Agrandit un rectangle de `pad` pixels de chaque côté (marge autour de l'élément éclairé). */
export function padRect(r: Rect, pad: number): Rect {
  return { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

/** Plus petit rectangle qui contient tous les rectangles donnés ; null s'il n'y en a aucun. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.left + r.width));
  const btm = Math.max(...rects.map(bottom));
  return { left, top, width: right - left, height: btm - top };
}

/**
 * Place la bulle sous la zone éclairée si la place suffit, sinon au-dessus, sinon au centre de l'écran (sans flèche).
 * Essaie d'abord un grand écart (flèche bien visible), puis un petit quand la place manque.
 * Elle reste toujours entièrement dans l'écran, à `margin` du bord.
 */
export function placeBubble(hole: Rect, view: Viewport, bubble: { w: number; h: number }, margin = 12, gaps: readonly number[] = [46, 18]): BubblePlacement {
  const left = clamp(hole.left + hole.width / 2 - bubble.w / 2, margin, view.w - margin - bubble.w);
  for (const gap of gaps) {
    if (bottom(hole) + gap + bubble.h + margin <= view.h) return { side: 'below', left, top: bottom(hole) + gap };
    if (hole.top - gap - bubble.h >= margin) return { side: 'above', left, top: hole.top - gap - bubble.h };
  }
  return { side: 'center', left: clamp((view.w - bubble.w) / 2, margin, view.w - margin - bubble.w), top: clamp((view.h - bubble.h) / 2, margin, view.h - margin - bubble.h) };
}

export interface HandArrow {
  /** Trait principal (courbe de Bézier, légèrement irrégulière). */
  d: string;
  /** Deux petits traits de la pointe. */
  head: string;
  from: Point;
  to: Point;
}

/** Flèche tracée comme à la main : courbe douce avec un petit zigzag, pointe en deux traits. `wobble` : amplitude (px). */
export function handArrow(from: Point, to: Point, wobble = 10): HandArrow {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Normale unitaire : sert à décaler les points de contrôle de chaque côté de la droite.
  const nx = -dy / len;
  const ny = dx / len;
  const c1 = { x: from.x + dx * 0.3 + nx * wobble * 1.6, y: from.y + dy * 0.3 + ny * wobble * 1.6 };
  const c2 = { x: from.x + dx * 0.7 - nx * wobble, y: from.y + dy * 0.7 - ny * wobble };
  const f = (n: number): string => n.toFixed(1);
  const d = `M ${f(from.x)} ${f(from.y)} C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(to.x)} ${f(to.y)}`;

  // Pointe : orientée selon la tangente d'arrivée (de c2 vers `to`).
  const angle = Math.atan2(to.y - c2.y, to.x - c2.x);
  const size = 14;
  const wing = (delta: number): Point => ({ x: to.x - size * Math.cos(angle + delta), y: to.y - size * Math.sin(angle + delta) });
  const a = wing(0.5);
  const b = wing(-0.5);
  const head = `M ${f(a.x)} ${f(a.y)} L ${f(to.x)} ${f(to.y)} L ${f(b.x)} ${f(b.y)}`;
  return { d, head, from, to };
}

/** Points de départ (bord de la bulle) et d'arrivée (bord de la zone éclairée) de la flèche ; null si la bulle est au centre. */
export function arrowEnds(hole: Rect, bubbleRect: Rect, side: BubbleSide, gap = 6): { from: Point; to: Point } | null {
  if (side === 'center') return null;
  const hx = hole.left + hole.width / 2;
  // L'arrivée vise le centre du bord de la zone ; le départ part du bord de la bulle, à la verticale du point visé si possible.
  const startX = clamp(hx, bubbleRect.left + 24, bubbleRect.left + bubbleRect.width - 24);
  if (side === 'below') return { from: { x: startX, y: bubbleRect.top - 2 }, to: { x: hx, y: bottom(hole) + gap } };
  return { from: { x: startX, y: bottom(bubbleRect) + 2 }, to: { x: hx, y: hole.top - gap } };
}
