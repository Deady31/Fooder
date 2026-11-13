import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DAILY_MISSIONS, MISSIONS_KEY, MISSION_TEMPLATES, MissionState,
  applyMissionProgress, missionDay, normalizeMissionState, pickMissions, progressMission, readMissionState,
} from '../lib/missions';
import { CelebrationEvent, onCelebration, resetCelebrations } from '../lib/celebrations';
import { XP_KEY } from '../lib/rewards';

function makeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => { data.set(k, String(v)); }),
    removeItem: (k: string) => { data.delete(k); },
  };
}

const NOON = Date.parse('2026-11-14T12:00:00Z');
const DAY = 'pour-test';

const stateWith = (ids: string[], date = DAY): MissionState => ({
  date,
  missions: ids.map(id => ({ ...MISSION_TEMPLATES.find(t => t.id === id)!, current: 0, completed: false })),
  rewarded: [],
});

describe('pickMissions', () => {
  it('3 missions distinctes, déterministes pour un jour donné', () => {
    const a = pickMissions('2026-11-14');
    expect(a).toHaveLength(DAILY_MISSIONS);
    expect(new Set(a.map(m => m.id)).size).toBe(DAILY_MISSIONS);
    expect(pickMissions('2026-11-14')).toEqual(a);
    expect(a.every(m => m.current === 0 && !m.completed)).toBe(true);
  });
});

describe('missionDay', () => {
  it('jour de Paris', () => {
    expect(missionDay(Date.parse('2026-11-14T23:30:00Z'))).toBe('2026-11-15');
  });
});

describe('normalizeMissionState', () => {
  it('jour différent ou valeur invalide : nouvelles missions', () => {
    const r = normalizeMissionState({ date: '2020-01-01', missions: [] }, '2026-11-14');
    expect(r.changed).toBe(true);
    expect(r.state.date).toBe('2026-11-14');
    expect(r.state.missions).toEqual(pickMissions('2026-11-14'));
    expect(normalizeMissionState('x', '2026-11-14').state.missions).toHaveLength(3);
    expect(normalizeMissionState(null, '2026-11-14').changed).toBe(true);
  });

  it('même jour : progression gardée, ids migrés', () => {
    const stored = {
      date: DAY,
      missions: [{ id: 'like_premium', title: 'x', description: 'x', emoji: 'x', target: 1, xpReward: 1, current: 1, completed: true }],
      rewarded: ['like_premium'],
    };
    const r = normalizeMissionState(stored, DAY);
    expect(r.state.missions[0]).toMatchObject({ id: 'like_gastro', current: 1, completed: true, xpReward: 35 });
    expect(r.state.rewarded).toEqual(['like_gastro']);
    expect(r.changed).toBe(true);
  });

  it('ancien format sans `rewarded` : les missions déjà terminées comptent comme versées (pas de double versement)', () => {
    const s = stateWith(['swipe_5', 'like_3']);
    const legacy = { date: DAY, missions: [{ ...s.missions[0], current: 5, completed: true }, s.missions[1]] };
    const r = normalizeMissionState(legacy, DAY);
    expect(r.state.rewarded).toEqual(['swipe_5']);
  });

  it('état déjà propre : changed=false', () => {
    const s = stateWith(['swipe_5']);
    expect(normalizeMissionState(s, DAY)).toEqual({ state: s, changed: false });
  });
});

describe('applyMissionProgress', () => {
  it('renvoie la mission au moment précis où elle se termine', () => {
    let s = stateWith(['like_3']);
    for (let i = 0; i < 2; i++) {
      const r = applyMissionProgress(s, 'like_3', 1);
      expect(r.completed).toBeNull();
      s = r.state;
    }
    const r = applyMissionProgress(s, 'like_3', 1);
    expect(r.completed).toMatchObject({ id: 'like_3', current: 3, completed: true, xpReward: 50 });
    expect(r.state.rewarded).toEqual(['like_3']);
  });

  it('plafonne à la cible et ne termine jamais deux fois', () => {
    const done = applyMissionProgress(stateWith(['swipe_5']), 'swipe_5', 99);
    expect(done.state.missions[0].current).toBe(5);
    const again = applyMissionProgress(done.state, 'swipe_5', 1);
    expect(again.completed).toBeNull();
    expect(again.state).toBe(done.state);
  });

  it('mission absente ou montant invalide : état inchangé (même référence)', () => {
    const s = stateWith(['swipe_5']);
    expect(applyMissionProgress(s, 'nope', 1).state).toBe(s);
    expect(applyMissionProgress(s, 'swipe_5', 0).state).toBe(s);
    expect(applyMissionProgress(s, 'swipe_5', Number.NaN).state).toBe(s);
  });

  it('ne mute pas l’état fourni', () => {
    const s = stateWith(['open_detail']);
    const snap = JSON.stringify(s);
    applyMissionProgress(s, 'open_detail', 1);
    expect(JSON.stringify(s)).toBe(snap);
  });
});

describe('progressMission (stockage + récompense)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let events: CelebrationEvent[];
  let off: () => void;

  beforeEach(() => {
    resetCelebrations();
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: () => true });
    events = [];
    off = onCelebration(e => events.push(e));
  });
  afterEach(() => {
    off();
    resetCelebrations();
    vi.unstubAllGlobals();
  });

  const today = () => missionDay(NOON);
  const seed = (ids: string[]) => storage.setItem(MISSIONS_KEY, JSON.stringify(stateWith(ids, today())));
  const xp = () => JSON.parse(storage.getItem(XP_KEY) ?? '{}').total ?? 0;

  it('renvoie la mission terminée, verse xpReward UNE fois par jour, émet `mission`', () => {
    seed(['open_detail', 'swipe_5', 'like_3']);
    const first = progressMission('open_detail', 1, { now: NOON });
    expect(first.completed).toMatchObject({ id: 'open_detail', completed: true, xpReward: 15 });
    expect(xp()).toBe(15);
    const missionEvents = events.filter(e => e.type === 'mission');
    expect(missionEvents).toEqual([{
      type: 'mission', id: 'open_detail', title: 'Curieux gourmand', description: 'Consulte 1 détail resto',
      xpReward: 15, day: today(), done: 1, total: 3,
    }]);
    expect(events.filter(e => e.type === 'xp')).toEqual([{ type: 'xp', amount: 15, total: 15, reason: 'mission' }]);

    // Même jour : plus jamais de versement, même si on rappelle progress.
    for (let i = 0; i < 3; i++) expect(progressMission('open_detail', 1, { now: NOON }).completed).toBeNull();
    expect(xp()).toBe(15);
    expect(events.filter(e => e.type === 'mission')).toHaveLength(1);
  });

  it('même si l’état stocké est remis à « non terminé » le même jour, pas de second versement', () => {
    seed(['open_detail']);
    progressMission('open_detail', 1, { now: NOON });
    const s = JSON.parse(storage.getItem(MISSIONS_KEY)!) as MissionState;
    storage.setItem(MISSIONS_KEY, JSON.stringify({ ...s, missions: s.missions.map(m => ({ ...m, current: 0, completed: false })) }));
    const again = progressMission('open_detail', 1, { now: NOON });
    expect(again.completed).toBeNull();
    expect(xp()).toBe(15);
  });

  it('persiste la progression partielle sans rien verser', () => {
    seed(['swipe_5']);
    progressMission('swipe_5', 1, { now: NOON });
    progressMission('swipe_5', 1, { now: NOON });
    const s = JSON.parse(storage.getItem(MISSIONS_KEY)!) as MissionState;
    expect(s.missions[0].current).toBe(2);
    expect(xp()).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('le lendemain, nouvelles missions et nouveau versement possible', () => {
    seed(['open_detail']);
    progressMission('open_detail', 1, { now: NOON });
    const tomorrow = NOON + 24 * 3_600_000;
    const s = readMissionState(tomorrow);
    expect(s.date).toBe(missionDay(tomorrow));
    expect(s.rewarded).toEqual([]);
    expect(s.missions.every(m => !m.completed)).toBe(true);
  });

  it('mission absente du jour : null, rien écrit', () => {
    seed(['swipe_5']);
    storage.setItem.mockClear();
    expect(progressMission('like_gastro', 1, { now: NOON }).completed).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('readMissionState écrit seulement si nécessaire', () => {
    seed(['swipe_5']);
    storage.setItem.mockClear();
    readMissionState(NOON);
    expect(storage.setItem).not.toHaveBeenCalled();
    storage.removeItem(MISSIONS_KEY);
    const s = readMissionState(NOON);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(s.missions).toHaveLength(3);
  });

  it('stockage indisponible : la progression continue en mémoire via `fallback`', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqué'); },
      setItem: () => { throw new Error('bloqué'); },
      removeItem: () => undefined,
    });
    const s0 = stateWith(['swipe_5'], today());
    const r1 = progressMission('swipe_5', 2, { now: NOON, fallback: s0 });
    expect(r1.state.missions[0].current).toBe(2);
    const r2 = progressMission('swipe_5', 1, { now: NOON, fallback: r1.state });
    expect(r2.state.missions[0].current).toBe(3);
  });
});
