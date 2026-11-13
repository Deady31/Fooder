import { describe, expect, it, vi } from 'vitest';
import {
  SHEET_HISTORY_KEY,
  createHistoryGuard,
  createScrollLock,
  dragCloseDecision,
  keyAction,
  nextFocusIndex,
  sheetMotion,
  shouldCloseOnBackdrop,
  type HistoryEnv,
} from '../components/ui/Sheet';
import { DUR, EASE, SPRING, reducedMotion } from '../lib/motion';

/** Faux environnement navigateur : pile d'historique + écouteurs popstate. */
function fakeEnv(initial: Record<string, unknown> | null = null) {
  const stack: Array<Record<string, unknown> | null> = [initial];
  let pos = 0;
  const listeners = new Set<() => void>();
  const env: HistoryEnv = {
    getState: () => stack[pos],
    pushState: (s) => {
      stack.splice(pos + 1);
      stack.push(s);
      pos++;
    },
    back: () => {
      if (pos > 0) {
        pos--;
        listeners.forEach((l) => l());
      }
    },
    addPopListener: (l) => listeners.add(l),
    removePopListener: (l) => listeners.delete(l),
  };
  return { env, stack: () => stack, pos: () => pos, listeners };
}

const immediate = (fn: () => void) => fn();

describe('nextFocusIndex (piège de focus)', () => {
  it('Tab avance et reboucle', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });
  it('Shift+Tab recule et reboucle', () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });
  it('focus hors de la feuille (-1) : premier / dernier', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });
  it('aucun élément focalisable : -1', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
  });
  it('un seul élément : reste dessus', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });
});

describe('keyAction', () => {
  it('Échap ferme', () => expect(keyAction('Escape', false)).toBe('close'));
  it('Tab / Shift+Tab piègent', () => {
    expect(keyAction('Tab', false)).toBe('tab');
    expect(keyAction('Tab', true)).toBe('shift-tab');
  });
  it('autres touches ignorées', () => {
    expect(keyAction('a', false)).toBe('none');
    expect(keyAction('Enter', false)).toBe('none');
  });
});

describe('shouldCloseOnBackdrop', () => {
  it('ferme seulement si option active ET clic direct sur le fond', () => {
    expect(shouldCloseOnBackdrop(true, true)).toBe(true);
    expect(shouldCloseOnBackdrop(true, false)).toBe(false);
    expect(shouldCloseOnBackdrop(false, true)).toBe(false);
  });
});

describe('dragCloseDecision', () => {
  it('petit glissement : revient', () => {
    expect(dragCloseDecision({ offsetY: 20, velocityY: 50, height: 600 })).toBe('stay');
  });
  it('glissement long : ferme', () => {
    expect(dragCloseDecision({ offsetY: 200, velocityY: 0, height: 600 })).toBe('close');
  });
  it('flick rapide : ferme même court', () => {
    expect(dragCloseDecision({ offsetY: 40, velocityY: 900, height: 600 })).toBe('close');
  });
  it('vers le haut ne ferme jamais', () => {
    expect(dragCloseDecision({ offsetY: -300, velocityY: -2000, height: 600 })).toBe('stay');
  });
  it('seuil borné sur petite feuille (80 min) et grande (160 max)', () => {
    expect(dragCloseDecision({ offsetY: 85, velocityY: 0, height: 100 })).toBe('close');
    expect(dragCloseDecision({ offsetY: 150, velocityY: 0, height: 2000 })).toBe('stay');
    expect(dragCloseDecision({ offsetY: 165, velocityY: 0, height: 2000 })).toBe('close');
  });
  it('valeurs invalides : reste', () => {
    expect(dragCloseDecision({ offsetY: NaN, velocityY: NaN, height: NaN })).toBe('stay');
  });
});

describe('createHistoryGuard', () => {
  it('pousse une entrée et préserve l\'état existant', () => {
    const f = fakeEnv({ foo: 1 });
    createHistoryGuard(f.env, 'a', vi.fn(), () => true, immediate);
    expect(f.pos()).toBe(1);
    expect(f.stack()[1]).toEqual({ foo: 1, [SHEET_HISTORY_KEY]: 'a' });
  });

  it('pas de doublon si l\'entrée est déjà la nôtre (re-montage StrictMode)', () => {
    const f = fakeEnv();
    createHistoryGuard(f.env, 'a', vi.fn(), () => true, immediate);
    createHistoryGuard(f.env, 'a', vi.fn(), () => true, immediate);
    expect(f.pos()).toBe(1);
  });

  it('retour navigateur (popstate) : appelle onClose une fois', () => {
    const f = fakeEnv();
    const onClose = vi.fn();
    createHistoryGuard(f.env, 'a', onClose, () => true, immediate);
    f.env.back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close() : revient en arrière, onClose via popstate, pas d\'entrée orpheline', () => {
    const f = fakeEnv();
    const onClose = vi.fn();
    const g = createHistoryGuard(f.env, 'a', onClose, () => true, immediate);
    g.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(f.pos()).toBe(0);
  });

  it('close() sans entrée à nous : appelle onClose directement', () => {
    const f = fakeEnv();
    const onClose = vi.fn();
    const g = createHistoryGuard(f.env, 'a', onClose, () => true, immediate);
    f.env.back(); // popstate -> onClose #1, entrée consommée
    g.close();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(f.pos()).toBe(0);
  });

  it('dispose() par le parent : retire notre entrée, sans rappeler onClose', () => {
    const f = fakeEnv();
    const onClose = vi.fn();
    const g = createHistoryGuard(f.env, 'a', onClose, () => false, immediate);
    g.dispose();
    expect(f.pos()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(f.listeners.size).toBe(0);
  });

  it('dispose() ne retire rien si re-monté entre temps (StrictMode)', () => {
    const f = fakeEnv();
    const g = createHistoryGuard(f.env, 'a', vi.fn(), () => true, immediate);
    g.dispose();
    expect(f.pos()).toBe(1);
  });

  it('dispose() après fermeture par retour : aucun back en trop', () => {
    const f = fakeEnv({ page: 'x' });
    const g = createHistoryGuard(f.env, 'a', vi.fn(), () => false, immediate);
    f.env.back();
    g.dispose();
    expect(f.pos()).toBe(0);
    expect(f.stack()[0]).toEqual({ page: 'x' });
  });

  it('feuilles imbriquées : le retour ne ferme que la feuille du dessus', () => {
    const f = fakeEnv();
    const outer = vi.fn();
    const inner = vi.fn();
    createHistoryGuard(f.env, 'outer', outer, () => true, immediate);
    createHistoryGuard(f.env, 'inner', inner, () => true, immediate);
    f.env.back();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    f.env.back();
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('ne se déclenche plus après dispose (pas de fuite d\'écouteur)', () => {
    const f = fakeEnv();
    const onClose = vi.fn();
    const g = createHistoryGuard(f.env, 'a', onClose, () => false, immediate);
    g.dispose();
    f.env.back();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('createScrollLock', () => {
  const body = () => ({ style: { overflow: '' } });
  it('verrouille puis restaure la valeur d\'origine', () => {
    const b = body();
    b.style.overflow = 'auto';
    const lock = createScrollLock(b);
    const unlock = lock();
    expect(b.style.overflow).toBe('hidden');
    unlock();
    expect(b.style.overflow).toBe('auto');
  });
  it('compte les verrous imbriqués', () => {
    const b = body();
    const lock = createScrollLock(b);
    const u1 = lock();
    const u2 = lock();
    u1();
    expect(b.style.overflow).toBe('hidden');
    u2();
    expect(b.style.overflow).toBe('');
  });
  it('unlock idempotent', () => {
    const b = body();
    const lock = createScrollLock(b);
    const u1 = lock();
    const u2 = lock();
    u1();
    u1();
    expect(b.style.overflow).toBe('hidden');
    u2();
    expect(b.style.overflow).toBe('');
  });
});

describe('sheetMotion', () => {
  it('bottom : entre par le bas, sort par le bas', () => {
    const m = sheetMotion('bottom', false);
    expect(m.initial).toMatchObject({ y: '100%' });
    expect(m.exit).toMatchObject({ y: '100%' });
    expect(m.animate).toMatchObject({ y: 0 });
  });
  it('top : entre par le haut', () => {
    expect(sheetMotion('top', false).initial).toMatchObject({ y: '-100%' });
  });
  it('full : fondu + léger glissement', () => {
    const m = sheetMotion('full', false);
    expect(m.initial).toMatchObject({ opacity: 0 });
    expect(m.animate).toMatchObject({ opacity: 1, y: 0 });
  });
  it('reduced motion : fondu uniquement, durée 0, pas de y', () => {
    for (const v of ['bottom', 'top', 'full'] as const) {
      const m = sheetMotion(v, true);
      expect(m.initial).toEqual({ opacity: 0 });
      expect(m.exit).toEqual({ opacity: 0 });
      expect(m.transition).toEqual({ duration: 0 });
    }
  });
});

describe('lib/motion', () => {
  it('SPRING reprend le ressort de SwipeDeck (290/28)', () => {
    expect(SPRING.lively).toMatchObject({ type: 'spring', stiffness: 290, damping: 28 });
  });
  it('trois ressorts ordonnés souple < vive < ferme', () => {
    expect(SPRING.soft.stiffness).toBeLessThan(SPRING.lively.stiffness);
    expect(SPRING.lively.stiffness).toBeLessThan(SPRING.firm.stiffness);
  });
  it('EASE.outExpo et DUR', () => {
    expect(EASE.outExpo).toEqual([0.16, 1, 0.3, 1]);
    expect(DUR.fast).toBeLessThan(DUR.base);
    expect(DUR.base).toBeLessThan(DUR.slow);
  });
  it('reducedMotion neutralise la transition seulement si demandé', () => {
    expect(reducedMotion(SPRING.soft, true)).toEqual({ duration: 0 });
    expect(reducedMotion(SPRING.soft, false)).toBe(SPRING.soft);
    expect(reducedMotion(SPRING.soft, null)).toBe(SPRING.soft);
  });
});
