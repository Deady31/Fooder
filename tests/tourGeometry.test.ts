import { describe, expect, it } from 'vitest';
import { arrowEnds, handArrow, padRect, placeBubble, unionRect, type Rect } from '../lib/tourGeometry';

const VIEW = { w: 320, h: 568 };
const BUBBLE = { w: 280, h: 120 };
const overlap = (a: Rect, b: Rect): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const rectOf = (p: { left: number; top: number }): Rect => ({ left: p.left, top: p.top, width: BUBBLE.w, height: BUBBLE.h });

describe('tourGeometry : placement de la bulle', () => {
  it('sous un élément en haut de l’écran', () => {
    const hole: Rect = { left: 10, top: 20, width: 44, height: 44 };
    const p = placeBubble(hole, VIEW, BUBBLE);
    expect(p.side).toBe('below');
    expect(overlap(rectOf(p), hole)).toBe(false);
  });

  it('au-dessus d’un élément en bas de l’écran (onglets)', () => {
    const hole: Rect = { left: 120, top: 505, width: 70, height: 50 };
    const p = placeBubble(hole, VIEW, BUBBLE);
    expect(p.side).toBe('above');
    expect(overlap(rectOf(p), hole)).toBe(false);
  });

  it('au centre, sans flèche, quand la zone prend presque tout l’écran', () => {
    const hole: Rect = { left: 8, top: 100, width: 304, height: 400 };
    const p = placeBubble(hole, VIEW, BUBBLE);
    expect(p.side).toBe('center');
    expect(arrowEnds(hole, rectOf(p), p.side)).toBeNull();
  });

  it('reste toujours entièrement dans l’écran, à la marge près', () => {
    for (const hole of [
      { left: 0, top: 10, width: 40, height: 40 },
      { left: 280, top: 10, width: 40, height: 40 },
      { left: 280, top: 520, width: 40, height: 40 },
      { left: 0, top: 520, width: 40, height: 40 },
    ] as Rect[]) {
      const p = placeBubble(hole, VIEW, BUBBLE, 12);
      expect(p.left).toBeGreaterThanOrEqual(12);
      expect(p.left + BUBBLE.w).toBeLessThanOrEqual(VIEW.w - 12);
      expect(p.top).toBeGreaterThanOrEqual(12);
      expect(p.top + BUBBLE.h).toBeLessThanOrEqual(VIEW.h - 12);
    }
  });
});

describe('tourGeometry : rectangles', () => {
  it('agrandit un rectangle de chaque côté', () => {
    expect(padRect({ left: 10, top: 10, width: 20, height: 20 }, 4)).toEqual({ left: 6, top: 6, width: 28, height: 28 });
  });

  it('réunit plusieurs rectangles (paquet + boutons) en un seul', () => {
    expect(unionRect([{ left: 10, top: 100, width: 300, height: 300 }, { left: 60, top: 420, width: 200, height: 70 }])).toEqual({ left: 10, top: 100, width: 300, height: 390 });
    expect(unionRect([])).toBeNull();
  });
});

describe('tourGeometry : flèche dessinée à la main', () => {
  const from = { x: 100, y: 200 };
  const to = { x: 180, y: 120 };

  it('part du point demandé et arrive au point visé', () => {
    const a = handArrow(from, to);
    expect(a.d.startsWith('M 100.0 200.0')).toBe(true);
    expect(a.d.endsWith('180.0 120.0')).toBe(true);
    expect(a.head).toContain('L 180.0 120.0');
  });

  it('est courbe : les points de contrôle ne sont pas sur la droite', () => {
    const nums = handArrow(from, to).d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const [c1x, c1y] = [nums[2], nums[3]];
    const cross = (c1x - from.x) * (to.y - from.y) - (c1y - from.y) * (to.x - from.x);
    expect(Math.abs(cross)).toBeGreaterThan(1);
  });

  it('même départ et arrivée : même tracé (pas de hasard)', () => {
    expect(handArrow(from, to)).toEqual(handArrow(from, to));
  });

  it('ne plante pas quand départ et arrivée sont confondus', () => {
    expect(() => handArrow({ x: 5, y: 5 }, { x: 5, y: 5 })).not.toThrow();
  });

  it('relie la bulle à la zone éclairée (côté bulle, côté zone)', () => {
    const hole: Rect = { left: 120, top: 505, width: 70, height: 50 };
    const p = placeBubble(hole, VIEW, BUBBLE);
    const ends = arrowEnds(hole, rectOf(p), p.side)!;
    expect(ends.from.y).toBeGreaterThan(p.top + BUBBLE.h - 1); // sous la bulle (elle est au-dessus)
    expect(ends.to.y).toBeLessThan(hole.top); // juste au-dessus de la zone
  });
});
