import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  TOULOUSE_CENTER,
  accuracyLevel,
  createPositionTracker,
  formatAccuracy,
  initialPosition,
  parseStoredPosition,
  roundCoord,
  roundCoords,
  statusFromError,
  toStoredPosition,
  type GeolocationLike,
} from '../lib/geo/position';

type Success = (p: GeolocationPosition) => void;
type Failure = (e: GeolocationPositionError) => void;

const pos = (lat: number, lng: number, accuracy: number): GeolocationPosition =>
  ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: 0 }) as unknown as GeolocationPosition;
const err = (code: number): GeolocationPositionError => ({ code, message: '' }) as GeolocationPositionError;

/** Faux navigator.geolocation piloté par le test. */
function fakeGeo() {
  const calls = { current: [] as { ok: Success; ko: Failure; opts?: PositionOptions }[], watch: [] as { id: number; ok: Success; ko: Failure; opts?: PositionOptions }[], cleared: [] as number[] };
  let next = 1;
  const geo: GeolocationLike = {
    getCurrentPosition: (ok, ko, opts) => { calls.current.push({ ok, ko: ko as Failure, opts }); },
    watchPosition: (ok, ko, opts) => { const id = next++; calls.watch.push({ id, ok, ko: ko as Failure, opts }); return id; },
    clearWatch: id => { calls.cleared.push(id); },
  };
  return { geo, calls };
}

describe('arrondis et stockage', () => {
  it('arrondit a 3 decimales (environ 100 m)', () => {
    expect(roundCoord(43.604512345)).toBe(43.605);
    expect(roundCoord(1.44421)).toBe(1.444);
    expect(roundCoord(-0.0004)).toBe(-0);
    expect(roundCoords({ lat: 43.60449, lng: 1.44451 }, 4)).toEqual({ lat: 43.6045, lng: 1.4445 });
  });

  it('memorise une position arrondie et horodatee', () => {
    expect(toStoredPosition({ lat: 43.6044912, lng: 1.4442561 }, 14.6, 1000)).toEqual({ lat: 43.604, lng: 1.444, accuracy: 15, at: 1000 });
  });

  it('relit une position valable 24 h, refuse le reste', () => {
    const now = 100 * 3600_000;
    const ok = { lat: 43.6, lng: 1.44, accuracy: 20, at: now - 3600_000 };
    expect(parseStoredPosition(ok, now)).toEqual(ok);
    expect(parseStoredPosition({ ...ok, at: now - 25 * 3600_000 }, now)).toBeNull();
    expect(parseStoredPosition({ ...ok, lat: 200 }, now)).toBeNull();
    expect(parseStoredPosition({ ...ok, lat: 'x' }, now)).toBeNull();
    expect(parseStoredPosition(null, now)).toBeNull();
    expect(parseStoredPosition('oups', now)).toBeNull();
    expect(parseStoredPosition({ ...ok, at: now + 3600_000 }, now)).toBeNull();
  });
});

describe('position de depart (le deck ne l attend jamais)', () => {
  it('sans memoire : centre de Toulouse (Capitole), source default', () => {
    const s = initialPosition(null, null);
    expect(s.coords).toEqual(TOULOUSE_CENTER);
    expect(s.source).toBe('default');
    expect(s.status).toBe('idle');
  });

  it('avec une derniere position : source last', () => {
    const s = initialPosition({ lat: 43.61, lng: 1.43, accuracy: 30, at: 5 }, null);
    expect(s.coords).toEqual({ lat: 43.61, lng: 1.43 });
    expect(s.source).toBe('last');
    expect(s.accuracy).toBe(30);
  });

  it('une adresse saisie a la main passe avant tout', () => {
    const s = initialPosition({ lat: 43.61, lng: 1.43, accuracy: 30, at: 5 }, { lat: 43.6, lng: 1.45, label: '1 rue X' });
    expect(s.source).toBe('manual');
    expect(s.label).toBe('1 rue X');
  });
});

describe('statuts et precision', () => {
  it('traduit les codes d erreur', () => {
    expect(statusFromError(1)).toBe('denied');
    expect(statusFromError(2)).toBe('unavailable');
    expect(statusFromError(3)).toBe('timeout');
    expect(statusFromError(99)).toBe('unavailable');
  });

  it('formate la precision', () => {
    expect(formatAccuracy(14.6)).toBe('±15 m');
    expect(formatAccuracy(1234)).toBe('±1,2 km');
  });

  it('niveau de fiabilite', () => {
    expect(accuracyLevel(15, 'gps')).toBe('good');
    expect(accuracyLevel(120, 'gps')).toBe('fair');
    expect(accuracyLevel(900, 'last')).toBe('poor');
    expect(accuracyLevel(10, 'last')).toBe('fair');
    expect(accuracyLevel(null, 'default')).toBe('none');
    expect(accuracyLevel(null, 'manual')).toBe('good');
  });
});

describe('createPositionTracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('haute precision, 8 s, cache raisonnable', () => {
    const { geo, calls } = fakeGeo();
    createPositionTracker(geo, { onFix: () => undefined, onError: () => undefined }).start();
    expect(calls.current[0].opts).toMatchObject({ enableHighAccuracy: true, timeout: 8000 });
    expect(calls.current[0].opts?.maximumAge).toBeGreaterThan(0);
    expect(calls.current[0].opts?.maximumAge).toBeLessThanOrEqual(120_000);
  });

  it('premiere position precise (<= 50 m) : pas de suivi', () => {
    const { geo, calls } = fakeGeo();
    const fixes: number[] = [];
    const done = vi.fn();
    createPositionTracker(geo, { onFix: f => fixes.push(f.accuracy), onError: () => undefined, onDone: done }).start();
    calls.current[0].ok(pos(43.6, 1.44, 12));
    expect(fixes).toEqual([12]);
    expect(calls.watch).toHaveLength(0);
    expect(done).toHaveBeenCalledOnce();
  });

  it('affine avec watchPosition jusqu a <= 50 m puis s arrete', () => {
    const { geo, calls } = fakeGeo();
    const fixes: number[] = [];
    const t = createPositionTracker(geo, { onFix: f => fixes.push(f.accuracy), onError: () => undefined });
    t.start();
    calls.current[0].ok(pos(43.6, 1.44, 800));
    expect(calls.watch).toHaveLength(1);
    expect(calls.watch[0].opts?.enableHighAccuracy).toBe(true);
    calls.watch[0].ok(pos(43.6, 1.44, 900)); // moins bon : ignoré
    calls.watch[0].ok(pos(43.6, 1.44, 120));
    calls.watch[0].ok(pos(43.6, 1.44, 40));
    expect(fixes).toEqual([800, 120, 40]);
    expect(calls.cleared).toEqual([calls.watch[0].id]);
    expect(t.isRunning()).toBe(false);
  });

  it('arret propre au bout de 20 s meme sans precision suffisante', () => {
    const { geo, calls } = fakeGeo();
    const t = createPositionTracker(geo, { onFix: () => undefined, onError: () => undefined });
    t.start();
    calls.current[0].ok(pos(43.6, 1.44, 300));
    vi.advanceTimersByTime(19_999);
    expect(calls.cleared).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(calls.cleared).toEqual([calls.watch[0].id]);
    expect(t.isRunning()).toBe(false);
  });

  it('stop() au demontage : suivi annule, plus aucun rappel', () => {
    const { geo, calls } = fakeGeo();
    const onFix = vi.fn();
    const t = createPositionTracker(geo, { onFix, onError: () => undefined });
    t.start();
    calls.current[0].ok(pos(43.6, 1.44, 300));
    t.stop();
    expect(calls.cleared).toEqual([calls.watch[0].id]);
    calls.watch[0].ok(pos(43.6, 1.44, 10));
    vi.advanceTimersByTime(30_000);
    expect(onFix).toHaveBeenCalledTimes(1);
  });

  it('refus : statut denied, pas de suivi', () => {
    const { geo, calls } = fakeGeo();
    const onError = vi.fn();
    createPositionTracker(geo, { onFix: () => undefined, onError }).start();
    calls.current[0].ko(err(1));
    expect(onError).toHaveBeenCalledWith('denied');
    expect(calls.watch).toHaveLength(0);
  });

  it('delai depasse : statut timeout, le suivi continue jusqu a 20 s (GPS lent a demarrer)', () => {
    const { geo, calls } = fakeGeo();
    const onError = vi.fn();
    const onFix = vi.fn();
    createPositionTracker(geo, { onFix, onError }).start();
    calls.current[0].ko(err(3));
    expect(onError).toHaveBeenCalledWith('timeout');
    expect(calls.watch).toHaveLength(1);
    calls.watch[0].ok(pos(43.6, 1.44, 25));
    expect(onFix).toHaveBeenCalledOnce();
    expect(calls.cleared).toHaveLength(1);
  });

  it('demande jamais resolue : aucun rappel, aucune minuterie qui bloque', () => {
    const { geo } = fakeGeo();
    const onFix = vi.fn();
    const onError = vi.fn();
    const t = createPositionTracker(geo, { onFix, onError });
    t.start();
    vi.advanceTimersByTime(60_000);
    expect(onFix).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    t.stop();
  });

  it('sans API de geolocalisation : unavailable', () => {
    const onError = vi.fn();
    createPositionTracker(null, { onFix: () => undefined, onError }).start();
    expect(onError).toHaveBeenCalledWith('unavailable');
  });
});
