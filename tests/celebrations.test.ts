import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CelebrationEvent, EMPTY_QUEUE, GAP_MS, PENDING_MAX, XP_COALESCE_MS,
  announceFor, celebrationKey, coalesceXp, emitCelebration, onCelebration, queueReducer, resetCelebrations,
} from '../lib/celebrations';
import { ACH_KEY, XP_KEY, awardXp, computeLevel, unlockAchievement } from '../lib/rewards';
import * as hookExports from '../hooks/useGamification';
import { STORE_EVENT } from '../lib/store';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => { data.set(k, String(v)); }),
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; },
  };
}

let storage: ReturnType<typeof makeStorage>;
let dispatched: string[];
let events: CelebrationEvent[];
let off: () => void;

beforeEach(() => {
  resetCelebrations();
  storage = makeStorage();
  dispatched = [];
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', {
    dispatchEvent: (e: Event) => {
      if (e.type === STORE_EVENT) dispatched.push((e as CustomEvent<string>).detail);
      return true;
    },
  });
  events = [];
  off = onCelebration(e => events.push(e));
});

afterEach(() => {
  off();
  resetCelebrations();
  vi.unstubAllGlobals();
});

const setXp = (total: number) => storage.setItem(XP_KEY, JSON.stringify({ total }));
const totalXp = () => JSON.parse(storage.getItem(XP_KEY) ?? '{}').total;
const ofType = <T extends CelebrationEvent['type']>(t: T) => events.filter(e => e.type === t) as Extract<CelebrationEvent, { type: T }>[];

describe('API publique conservée', () => {
  it('useGamification ré-exporte les constantes et computeLevel', () => {
    expect(hookExports.XP_KEY).toBe('fooder_xp');
    expect(hookExports.ACH_KEY).toBe('fooder_achievements');
    expect(hookExports.ALL_ACHIEVEMENTS.length).toBeGreaterThan(20);
    expect(hookExports.LEVEL_THRESHOLDS[1]).toBe(50);
    expect(hookExports.computeLevel(0)).toBe(1);
    expect(hookExports.computeLevel(50)).toBe(2);
    expect(hookExports.computeLevel(99999)).toBe(10);
    expect(typeof hookExports.useGamification).toBe('function');
  });
});

describe('bus d’événements', () => {
  it('livre chaque événement aux abonnés, puis plus rien après désabonnement', () => {
    const got: CelebrationEvent[] = [];
    const stop = onCelebration(e => got.push(e));
    emitCelebration({ type: 'achievement', id: 'first_like', title: 'Coup de cœur', description: 'x' });
    stop();
    emitCelebration({ type: 'achievement', id: 'likes_10', title: 'Gourmet', description: 'x' });
    expect(got.map(e => e.type === 'achievement' && e.id)).toEqual(['first_like']);
  });

  it('garde les événements émis sans abonné et les livre au premier abonnement (aucune perte)', () => {
    off();
    emitCelebration({ type: 'achievement', id: 'a', title: 'A', description: '' });
    emitCelebration({ type: 'achievement', id: 'b', title: 'B', description: '' });
    const got: string[] = [];
    off = onCelebration(e => got.push(e.type === 'achievement' ? e.id : e.type));
    expect(got).toEqual(['a', 'b']);
    // Livrés une seule fois.
    const again: string[] = [];
    const stop = onCelebration(e => again.push(e.type));
    expect(again).toEqual([]);
    stop();
  });

  it('borne la file d’attente sans abonné', () => {
    off();
    for (let i = 0; i < PENDING_MAX + 10; i++) emitCelebration({ type: 'xp', amount: 1, total: i, reason: 'other' });
    const got: CelebrationEvent[] = [];
    off = onCelebration(e => got.push(e));
    expect(got).toHaveLength(PENDING_MAX);
  });

  it('un abonné qui plante n’empêche pas les autres', () => {
    const stop = onCelebration(() => { throw new Error('boum'); });
    emitCelebration({ type: 'xp', amount: 5, total: 5, reason: 'swipe' });
    expect(events).toHaveLength(1);
    stop();
  });
});

describe('awardXp : un seul chemin pour l’XP', () => {
  it('écrit via lib/store (STORE_EVENT) et émet un événement xp', () => {
    setXp(10);
    expect(awardXp(15, 'like')).toBeNull();
    expect(totalXp()).toBe(25);
    expect(dispatched).toContain(XP_KEY);
    expect(ofType('xp')).toEqual([{ type: 'xp', amount: 15, total: 25, reason: 'like' }]);
    expect(ofType('level')).toHaveLength(0);
  });

  it('raison par défaut « other » (signature historique awardXp(amount))', () => {
    awardXp(5);
    expect(ofType('xp')[0].reason).toBe('other');
  });

  it('franchir un seuil émet EXACTEMENT un événement level', () => {
    setXp(40);
    expect(awardXp(20, 'swipe')).toBe(2);
    const levels = ofType('level');
    expect(levels).toEqual([{ type: 'level', level: 2, from: 1, gained: 1, total: 60 }]);
  });

  it('plusieurs niveaux d’un coup : un seul événement avec le niveau final et les niveaux gagnés', () => {
    setXp(0);
    expect(awardXp(350, 'visit')).toBe(4);
    expect(ofType('level')).toEqual([{ type: 'level', level: 4, from: 1, gained: 3, total: 350 }]);
  });

  it('l’événement xp précède l’événement level', () => {
    setXp(45);
    awardXp(10, 'like');
    expect(events.map(e => e.type).slice(0, 2)).toEqual(['xp', 'level']);
  });

  it('niveau 5 : événement level puis succès level_5, une seule fois', () => {
    setXp(490);
    awardXp(20, 'visit');
    expect(events.map(e => e.type)).toEqual(['xp', 'level', 'achievement']);
    expect(ofType('achievement')[0].id).toBe('level_5');
    awardXp(20, 'visit');
    expect(ofType('achievement')).toHaveLength(1);
    expect(ofType('level')).toHaveLength(1);
  });

  it('ignore les montants invalides : rien d’écrit, rien d’émis', () => {
    setXp(10);
    storage.setItem.mockClear();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(awardXp(bad)).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
    expect(totalXp()).toBe(10);
  });

  it('tolère un stockage corrompu et conserve les autres champs', () => {
    storage.setItem(XP_KEY, JSON.stringify({ total: 'abc', extra: 1 }));
    awardXp(5);
    expect(JSON.parse(storage.getItem(XP_KEY)!)).toEqual({ total: 5, extra: 1 });
    storage.setItem(XP_KEY, '{oups');
    awardXp(5);
    expect(totalXp()).toBe(5);
  });

  it('si l’écriture échoue, rien n’est célébré (pas d’XP fantôme)', () => {
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    expect(awardXp(100)).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('cohérent avec computeLevel', () => {
    setXp(0);
    awardXp(5000);
    expect(ofType('level')[0].level).toBe(computeLevel(5000));
  });
});

describe('unlockAchievement', () => {
  it('émet un événement achievement une seule fois', () => {
    expect(unlockAchievement('first_like')).toBe(true);
    expect(unlockAchievement('first_like')).toBe(false);
    expect(ofType('achievement')).toEqual([
      { type: 'achievement', id: 'first_like', title: 'Coup de cœur', description: 'Premier restaurant liké' },
    ]);
    expect(JSON.parse(storage.getItem(ACH_KEY)!)).toEqual(['first_like']);
  });

  it('id inconnu : rien', () => {
    expect(unlockAchievement('nope')).toBe(false);
    expect(events).toHaveLength(0);
  });
});

const ach = (id: string): CelebrationEvent => ({ type: 'achievement', id, title: id, description: '' });
const lvl = (level: number, from = level - 1): CelebrationEvent => ({ type: 'level', level, from, gained: level - from, total: 0 });

describe('file de célébrations', () => {
  const enqueue = (s: typeof EMPTY_QUEUE, e: CelebrationEvent) => queueReducer(s, { type: 'enqueue', event: e as never });

  it('deux déblocages dans le même tick sont affichés l’un après l’autre, jamais écrasés', () => {
    let s = enqueue(enqueue(EMPTY_QUEUE, ach('first_swipe')), ach('first_like'));
    expect(celebrationKey(s.current!.event)).toBe('achievement:first_swipe');
    expect(s.queue.map(i => celebrationKey(i.event))).toEqual(['achievement:first_like']);
    s = queueReducer(s, { type: 'done' });
    expect(s.current).toBeNull();
    expect(s.resting).toBe(true);
    s = queueReducer(s, { type: 'advance' });
    expect(celebrationKey(s.current!.event)).toBe('achievement:first_like');
    s = queueReducer(queueReducer(s, { type: 'done' }), { type: 'advance' });
    expect(s.current).toBeNull();
    expect(s.resting).toBe(false);
  });

  it('pendant la pause entre deux éléments, un nouvel élément attend', () => {
    let s = queueReducer(enqueue(EMPTY_QUEUE, ach('a')), { type: 'done' });
    s = enqueue(s, ach('b'));
    expect(s.current).toBeNull();
    expect(s.queue).toHaveLength(1);
    s = queueReducer(s, { type: 'advance' });
    expect(celebrationKey(s.current!.event)).toBe('achievement:b');
  });

  it('priorité : un niveau passe devant les succès en attente, sans interrompre l’élément affiché', () => {
    let s = enqueue(EMPTY_QUEUE, ach('a'));
    s = enqueue(s, ach('b'));
    s = enqueue(s, lvl(3));
    expect(celebrationKey(s.current!.event)).toBe('achievement:a');
    expect(s.queue.map(i => i.event.type)).toEqual(['level', 'achievement']);
  });

  it('FIFO à priorité égale (succès et missions)', () => {
    let s = enqueue(EMPTY_QUEUE, ach('a'));
    s = enqueue(s, { type: 'mission', id: 'swipe_5', title: 'M', description: '', xpReward: 25, day: 'd', done: 1, total: 3 });
    s = enqueue(s, ach('c'));
    expect(s.queue.map(i => celebrationKey(i.event))).toEqual(['mission:d:swipe_5', 'achievement:c']);
  });

  it('jamais deux fois le même élément', () => {
    let s = enqueue(EMPTY_QUEUE, ach('a'));
    s = enqueue(s, ach('a'));
    expect(s.queue).toHaveLength(0);
    s = queueReducer(queueReducer(s, { type: 'done' }), { type: 'advance' });
    s = enqueue(s, ach('a'));
    expect(s.current).toBeNull();
    expect(s.queue).toHaveLength(0);
  });

  it('deux passages de niveau en attente fusionnent en un seul (niveau final, total des niveaux)', () => {
    let s = enqueue(EMPTY_QUEUE, ach('a'));
    s = enqueue(s, lvl(3, 2));
    s = enqueue(s, lvl(5, 3));
    const levels = s.queue.filter(i => i.event.type === 'level');
    expect(levels).toHaveLength(1);
    expect(levels[0].event).toMatchObject({ level: 5, from: 2, gained: 3 });
  });

  it('les événements xp ne passent pas par la file', () => {
    const s = enqueue(EMPTY_QUEUE, { type: 'xp', amount: 5, total: 5, reason: 'swipe' });
    expect(s).toBe(EMPTY_QUEUE);
  });

  it('pur : ne mute pas l’état fourni', () => {
    const s = enqueue(EMPTY_QUEUE, ach('a'));
    const snap = JSON.stringify(s);
    enqueue(s, ach('b'));
    queueReducer(s, { type: 'done' });
    expect(JSON.stringify(s)).toBe(snap);
    expect(GAP_MS).toBeGreaterThan(0);
  });
});

describe('coalesceXp (« +15 » regroupés)', () => {
  const xp = (amount: number, total = 0) => ({ type: 'xp' as const, amount, total, reason: 'swipe' as const });

  it('regroupe les gains rapprochés', () => {
    const a = coalesceXp(null, xp(5, 5), 1000);
    expect(a).toMatchObject({ amount: 5, from: 0, total: 5 });
    const b = coalesceXp(a, xp(15, 20), 1000 + XP_COALESCE_MS - 1);
    expect(b).toMatchObject({ id: a.id, amount: 20, from: 5, total: 20 });
  });

  it('nouvelle bulle après la fenêtre', () => {
    const a = coalesceXp(null, xp(5), 0);
    const b = coalesceXp(a, xp(15), XP_COALESCE_MS + 1);
    expect(b.id).not.toBe(a.id);
    expect(b).toMatchObject({ amount: 15, from: 0 });
  });
});

describe('annonces lecteur d’écran', () => {
  it('textes en français', () => {
    expect(announceFor({ type: 'xp', amount: 15, total: 15, reason: 'like' })).toBe('+15 XP');
    expect(announceFor(lvl(4))).toBe('Niveau 4 atteint !');
    expect(announceFor(ach('x'))).toBe('Trophée débloqué : x');
    expect(announceFor({ type: 'mission', id: 'm', title: 'Curieux gourmand', description: '', xpReward: 15, day: 'd', done: 2, total: 3 }))
      .toBe('Mission accomplie : Curieux gourmand, +15 XP');
  });
});
