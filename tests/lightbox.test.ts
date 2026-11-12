import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampPan,
  clampZoom,
  containedSize,
  distance,
  doubleTapZoom,
  gestureDecision,
  photoCreditLine,
  pinchZoom,
  wheelZoom,
} from '../components/ui/lightboxMath';

describe('clampZoom', () => {
  it('borne entre 1 et 4', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
  });
  it('valeurs invalides -> 1', () => {
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(MAX_ZOOM);
  });
});

describe('containedSize', () => {
  it('image paysage dans un conteneur portrait : limitée par la largeur', () => {
    expect(containedSize({ w: 2000, h: 1000 }, { w: 400, h: 800 })).toEqual({ w: 400, h: 200 });
  });
  it('image portrait : limitée par la hauteur', () => {
    expect(containedSize({ w: 1000, h: 2000 }, { w: 400, h: 600 })).toEqual({ w: 300, h: 600 });
  });
  it('taille inconnue -> taille du conteneur', () => {
    expect(containedSize({ w: 0, h: 0 }, { w: 400, h: 600 })).toEqual({ w: 400, h: 600 });
  });
});

describe('clampPan', () => {
  const img = { w: 400, h: 200 };
  const box = { w: 400, h: 800 };
  it('zoom 1 : pas de pan', () => {
    expect(clampPan({ x: 50, y: -30 }, 1, img, box)).toEqual({ x: 0, y: 0 });
  });
  it('zoom 2 : horizontal borné à (800-400)/2 = 200, vertical centré (400 < 800)', () => {
    expect(clampPan({ x: 999, y: 999 }, 2, img, box)).toEqual({ x: 200, y: 0 });
    expect(clampPan({ x: -999, y: 5 }, 2, img, box)).toEqual({ x: -200, y: 0 });
  });
  it('image haute : pan vertical autorisé', () => {
    expect(clampPan({ x: 0, y: 5000 }, 4, { w: 400, h: 800 }, { w: 400, h: 800 })).toEqual({ x: 0, y: 1200 });
  });
  it('conserve un pan valide', () => {
    expect(clampPan({ x: 10, y: 0 }, 2, img, box)).toEqual({ x: 10, y: 0 });
  });
});

describe('pinchZoom', () => {
  it('proportionnel à l écart des doigts', () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(2, 200, 100)).toBe(1);
  });
  it('borne et ignore une distance de départ nulle', () => {
    expect(pinchZoom(2, 100, 1000)).toBe(MAX_ZOOM);
    expect(pinchZoom(1, 100, 10)).toBe(MIN_ZOOM);
    expect(pinchZoom(2, 0, 50)).toBe(2);
  });
});

describe('distance, doubleTapZoom, wheelZoom', () => {
  it('distance euclidienne', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('double tap : 1 -> 2 -> 1', () => {
    expect(doubleTapZoom(1)).toBe(2);
    expect(doubleTapZoom(2)).toBe(1);
    expect(doubleTapZoom(4)).toBe(1);
  });
  it('molette : deltaY négatif zoome, positif dézoome, borné', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(2, 100)).toBeLessThan(2);
    expect(wheelZoom(1, 100)).toBe(1);
    expect(wheelZoom(4, -1000)).toBe(MAX_ZOOM);
  });
});

describe('gestureDecision', () => {
  const base = { dx: 0, dy: 0, zoom: 1, width: 400, index: 1, count: 3 };
  it('glisser gauche suffisant -> suivante', () => {
    expect(gestureDecision({ ...base, dx: -120 })).toBe('next');
  });
  it('glisser droite suffisant -> précédente', () => {
    expect(gestureDecision({ ...base, dx: 120 })).toBe('prev');
  });
  it('trop court -> rien', () => {
    expect(gestureDecision({ ...base, dx: -30 })).toBe('none');
  });
  it('un flick rapide court suffit', () => {
    expect(gestureDecision({ ...base, dx: -40, vx: -0.8 })).toBe('next');
  });
  it('aux extrémités -> rien', () => {
    expect(gestureDecision({ ...base, index: 2, dx: -200 })).toBe('none');
    expect(gestureDecision({ ...base, index: 0, dx: 200 })).toBe('none');
  });
  it('zoomé : jamais de swipe ni de fermeture', () => {
    expect(gestureDecision({ ...base, zoom: 2, dx: -300 })).toBe('none');
    expect(gestureDecision({ ...base, zoom: 2, dy: 300 })).toBe('none');
  });
  it('glisser vers le bas dominant -> fermer', () => {
    expect(gestureDecision({ ...base, dy: 150 })).toBe('close');
  });
  it('vers le bas mais surtout horizontal -> pas de fermeture', () => {
    expect(gestureDecision({ ...base, dx: 20, dy: 90 })).toBe('none');
    expect(gestureDecision({ ...base, dx: 200, dy: 150 })).toBe('prev');
  });
  it('vers le haut -> rien', () => {
    expect(gestureDecision({ ...base, dy: -200 })).toBe('none');
  });
});

describe('photoCreditLine', () => {
  it('Google avec auteur', () => {
    expect(photoCreditLine('google', 'Marie D.')).toBe('Photo Google Maps · Marie D.');
    expect(photoCreditLine('google')).toBe('Photo Google Maps');
  });
  it('plat typique : auteur et licence', () => {
    expect(photoCreditLine('dish', 'Jean', 'CC BY-SA 4.0')).toBe('Plat typique · Jean, CC BY-SA 4.0');
    expect(photoCreditLine('dish')).toBe('Plat typique');
  });
  it('communauté / inconnu : aucun crédit', () => {
    expect(photoCreditLine('community', 'x')).toBeNull();
    expect(photoCreditLine(undefined)).toBeNull();
  });
});
