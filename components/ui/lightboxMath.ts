export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }

export function clampZoom(z: number): number {
  if (Number.isNaN(z)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Taille affichée d'une image en object-contain dans un conteneur (zoom 1). */
export function containedSize(natural: Size, box: Size): Size {
  if (!(natural.w > 0) || !(natural.h > 0)) return { ...box };
  const scale = Math.min(box.w / natural.w, box.h / natural.h);
  return { w: natural.w * scale, h: natural.h * scale };
}

/** Borne le décalage : l'image zoomée ne peut pas laisser de vide dans le conteneur. */
export function clampPan(pan: Point, zoom: number, img: Size, box: Size): Point {
  const maxX = Math.max(0, (img.w * zoom - box.w) / 2);
  const maxY = Math.max(0, (img.h * zoom - box.h) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)) || 0,
    y: Math.min(maxY, Math.max(-maxY, pan.y)) || 0,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pinchZoom(startZoom: number, startDist: number, currentDist: number): number {
  if (!(startDist > 0)) return clampZoom(startZoom);
  return clampZoom(startZoom * (currentDist / startDist));
}

export function doubleTapZoom(zoom: number): number {
  return zoom > 1 ? 1 : 2;
}

export function wheelZoom(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * 0.002));
}

export type GestureOutcome = 'next' | 'prev' | 'close' | 'none';

interface GestureInput {
  dx: number;
  dy: number;
  zoom: number;
  width: number;
  index: number;
  count: number;
  /** vitesse horizontale en px/ms (négatif = vers la gauche) */
  vx?: number;
}

const FLICK_SPEED = 0.5;
const CLOSE_DISTANCE = 100;

export function gestureDecision({ dx, dy, zoom, width, index, count, vx = 0 }: GestureInput): GestureOutcome {
  if (zoom > 1) return 'none';
  const horizontal = Math.abs(dx) > Math.abs(dy);
  if (horizontal) {
    const far = Math.abs(dx) > Math.max(60, width * 0.2);
    const flick = Math.abs(vx) > FLICK_SPEED && Math.abs(dx) > 24;
    if (!far && !flick) return 'none';
    if (dx < 0) return index < count - 1 ? 'next' : 'none';
    return index > 0 ? 'prev' : 'none';
  }
  if (dy > CLOSE_DISTANCE) return 'close';
  return 'none';
}

/** Ligne de crédit affichée sous la photo agrandie (null si rien à créditer). */
export function photoCreditLine(
  source: string | undefined,
  credit?: string,
  license?: string,
): string | null {
  if (source === 'google') return credit ? `Photo Google Maps · ${credit}` : 'Photo Google Maps';
  if (source === 'site' || source === 'restaurant') return credit || 'Photo du restaurant';
  if (source === 'dish') {
    const who = [credit, license].filter(Boolean).join(', ');
    return who ? `Plat typique · ${who}` : 'Plat typique';
  }
  return null;
}
