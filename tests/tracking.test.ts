import { describe, expect, it, vi } from 'vitest';
import {
  BATCH_SIZE,
  FLUSH_THRESHOLD,
  HEARTBEAT_MS,
  IDLE_MS,
  MAX_FAILURES,
  MAX_QUEUE,
  QUEUE_KEY,
  SESSION_KEY,
  SESSION_TIMEOUT_MS,
  TrackEvent,
  TrackingDeps,
  buildEvent,
  cleanLabel,
  cleanRestId,
  createTracker,
  enqueue,
  isValidEventName,
  parseQueue,
  parseSession,
  resolveSession,
  restIdFromPath,
  sanitizeTrackProps,
  screenFromPath,
  takeBatch,
} from '../lib/tracking';
import type { KeyValueStore, SendResult } from '../lib/usage';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const T0 = Date.parse('2026-11-13T10:00:00Z');

function setup(over: Partial<TrackingDeps> = {}) {
  let now = T0;
  let n = 0;
  const local = new MemoryStore();
  const session = new MemoryStore();
  const sent: TrackEvent[][] = [];
  const send = vi.fn(async (rows: TrackEvent[]): Promise<SendResult> => {
    sent.push(rows);
    return 'ok';
  });
  const deps: TrackingDeps = {
    cloudEnabled: () => true,
    optedIn: () => true,
    hasSession: async () => true,
    send,
    storage: local,
    sessionStorage: session,
    now: () => now,
    newId: () => `sess_${String(++n).padStart(6, '0')}`,
    setTimer: () => 0,
    ...over,
  };
  const tracker = createTracker(deps);
  return { tracker, deps, local, session, sent, send, advance: (ms: number) => (now += ms), getNow: () => now };
}

describe('validation des noms d’événements', () => {
  it('accepte minuscules, chiffres et _ de 2 à 40 caractères', () => {
    expect(isValidEventName('swipe_like')).toBe(true);
    expect(isValidEventName('screen_view')).toBe(true);
    expect(isValidEventName('a1')).toBe(true);
    expect(isValidEventName('x'.repeat(40))).toBe(true);
  });
  it('refuse le reste', () => {
    expect(isValidEventName('a')).toBe(false);
    expect(isValidEventName('x'.repeat(41))).toBe(false);
    expect(isValidEventName('Swipe')).toBe(false);
    expect(isValidEventName('swipe-like')).toBe(false);
    expect(isValidEventName('swipe like')).toBe(false);
    expect(isValidEventName(42)).toBe(false);
    expect(isValidEventName(null)).toBe(false);
  });
});

describe('nettoyage des propriétés', () => {
  it('garde les valeurs simples et borne les textes', () => {
    const out = sanitizeTrackProps({ a: 1, b: true, c: 'thai', d: 'x'.repeat(500), bad: { nested: 1 }, arr: [1], nan: NaN });
    expect(out.a).toBe(1);
    expect(out.b).toBe(true);
    expect(out.c).toBe('thai');
    expect((out.d as string).length).toBeLessThanOrEqual(120);
    expect('bad' in out).toBe(false);
    expect('arr' in out).toBe(false);
    expect('nan' in out).toBe(false);
  });
  it('ignore les clés mal formées et limite le nombre de clés', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 50; i++) many[`k${i}`] = i;
    expect(Object.keys(sanitizeTrackProps(many)).length).toBe(20);
    expect(sanitizeTrackProps({ 'Bad Key': 1, ok_key: 2 })).toEqual({ ok_key: 2 });
  });
  it('reste sous 2 Ko une fois sérialisé', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 20; i++) big[`k${i}`] = 'y'.repeat(120);
    expect(JSON.stringify(sanitizeTrackProps(big)).length).toBeLessThan(2048);
  });
  it('entrée non objet : objet vide', () => {
    expect(sanitizeTrackProps(null)).toEqual({});
    expect(sanitizeTrackProps('x')).toEqual({});
    expect(sanitizeTrackProps([1, 2])).toEqual({});
  });
});

describe('écrans et restos', () => {
  it('normalise les chemins', () => {
    expect(screenFromPath('/swipe')).toBe('/swipe');
    expect(screenFromPath('/swipe/')).toBe('/swipe');
    expect(screenFromPath('/')).toBe('/');
    expect(screenFromPath('/resto/osm-n29047143?x=1#top')).toBe('/resto/[id]');
    expect(screenFromPath('/amis/ajouter')).toBe('/amis/ajouter');
    expect(screenFromPath('/groupe/g0123456789abcdef01')).toBe('/groupe/[id]');
    expect(screenFromPath('')).toBe('/');
    expect(screenFromPath(undefined)).toBe('/');
  });
  it('extrait l’id du resto de /resto/<id>', () => {
    expect(restIdFromPath('/resto/osm-n29047143')).toBe('osm-n29047143');
    expect(restIdFromPath('/swipe')).toBeNull();
  });
  it('valide un id de resto', () => {
    expect(cleanRestId('osm-n1')).toBe('osm-n1');
    expect(cleanRestId('ovt-0f2b-11')).toBe('ovt-0f2b-11');
    expect(cleanRestId('<script>')).toBeNull();
    expect(cleanRestId('x'.repeat(81))).toBeNull();
    expect(cleanRestId(12)).toBeNull();
  });
});

describe('libellés de clics', () => {
  it('nettoie les espaces et coupe à 40 caractères', () => {
    expect(cleanLabel('  On   mange\n où ?  ')).toBe('On mange où ?');
    expect(cleanLabel('a'.repeat(80))!.length).toBeLessThanOrEqual(40);
  });
  it('masque e-mails et longues suites de chiffres', () => {
    expect(cleanLabel('Envoyer à jean@exemple.fr')).toBe('Envoyer à [email]');
    expect(cleanLabel('Code 123456')).toBe('Code #');
  });
  it('vide : null', () => {
    expect(cleanLabel('   ')).toBeNull();
    expect(cleanLabel(null)).toBeNull();
  });
});

describe('sessions (30 min d’inactivité)', () => {
  it('crée une session si rien n’existe', () => {
    const r = resolveSession(null, T0, () => 'sess_new_1');
    expect(r.started).toBe(true);
    expect(r.expired).toBeNull();
    expect(r.session).toMatchObject({ id: 'sess_new_1', startedAt: T0, lastActivity: T0 });
  });
  it('prolonge une session active', () => {
    const prev = { id: 'sess_a_0001', startedAt: T0, lastActivity: T0, activeMs: 0 };
    const r = resolveSession(prev, T0 + SESSION_TIMEOUT_MS - 1, () => 'sess_b_0001');
    expect(r.started).toBe(false);
    expect(r.session.id).toBe('sess_a_0001');
    expect(r.session.lastActivity).toBe(T0 + SESSION_TIMEOUT_MS - 1);
    expect(prev.lastActivity).toBe(T0); // pas de mutation
  });
  it('expire après 30 min sans activité', () => {
    const prev = { id: 'sess_a_0001', startedAt: T0, lastActivity: T0 + 1000, activeMs: 0 };
    const r = resolveSession(prev, T0 + 1000 + SESSION_TIMEOUT_MS, () => 'sess_b_0001');
    expect(r.started).toBe(true);
    expect(r.session.id).toBe('sess_b_0001');
    expect(r.expired?.id).toBe('sess_a_0001');
  });
  it('relit une session stockée en la validant', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('pas du json')).toBeNull();
    expect(parseSession(JSON.stringify({ id: 'x' }))).toBeNull();
    const ok = parseSession(JSON.stringify({ id: 'sess_a_0001', startedAt: T0, lastActivity: T0, activeMs: 15000 }));
    expect(ok?.id).toBe('sess_a_0001');
    expect(ok?.activeMs).toBe(15000);
  });
});

describe('construction des événements', () => {
  it('sort rest_id et screen des propriétés vers des colonnes', () => {
    const e = buildEvent('swipe_like', { cuisine: 'thai', rest_id: 'osm-n1', screen: '/swipe' }, { sessionId: 'sess_a_0001', screen: '/map', now: T0 });
    expect(e).toMatchObject({ name: 'swipe_like', session_id: 'sess_a_0001', screen: '/swipe', rest_id: 'osm-n1', props: { cuisine: 'thai' } });
    expect(e?.created_at).toBe(new Date(T0).toISOString());
  });
  it('prend l’écran courant par défaut et refuse un nom invalide', () => {
    expect(buildEvent('open_card', {}, { sessionId: 's', screen: '/map', now: T0 })?.screen).toBe('/map');
    expect(buildEvent('Bad Name', {}, { sessionId: 's', screen: null, now: T0 })).toBeNull();
  });
});

describe('file et lots', () => {
  const ev = (i: number): TrackEvent => ({ name: 'x_' + i, session_id: 's', screen: null, rest_id: null, props: {}, created_at: new Date(T0).toISOString() });
  it('file bornée, plus anciens abandonnés, sans mutation', () => {
    let q: TrackEvent[] = [];
    for (let i = 0; i < MAX_QUEUE + 10; i++) q = enqueue(q, ev(i));
    expect(q.length).toBe(MAX_QUEUE);
    expect(q[0].name).toBe('x_10');
    const before = [ev(1)];
    enqueue(before, ev(2));
    expect(before.length).toBe(1);
  });
  it('lot de taille BATCH_SIZE', () => {
    const q = Array.from({ length: BATCH_SIZE + 5 }, (_, i) => ev(i));
    expect(takeBatch(q).length).toBe(BATCH_SIZE);
  });
  it('relit la file stockée en écartant les lignes invalides', () => {
    const raw = JSON.stringify([ev(1), { name: 'Bad Name' }, 'x', { ...ev(2), props: { ok: 1, bad: { a: 1 } } }]);
    const q = parseQueue(raw);
    expect(q.map(e => e.name)).toEqual(['x_1', 'x_2']);
    expect(q[1].props).toEqual({ ok: 1 });
    expect(parseQueue('{')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
  });
});

describe('tracker', () => {
  it('no-op total si le cloud est absent', async () => {
    const { tracker, send, local } = setup({ cloudEnabled: () => false });
    expect(tracker.track('swipe_like')).toBe(false);
    await tracker.flush();
    expect(send).not.toHaveBeenCalled();
    expect(local.data.size).toBe(0);
  });

  it('respecte le réglage « mesures d’usage »', () => {
    const { tracker } = setup({ optedIn: () => false });
    expect(tracker.track('swipe_like')).toBe(false);
    expect(tracker.size()).toBe(0);
  });

  it('premier événement : session_start puis l’événement, même session', () => {
    const { tracker, local, session } = setup();
    tracker.screenView('/swipe');
    const q = parseQueue(local.getItem(QUEUE_KEY));
    expect(q.map(e => e.name)).toEqual(['session_start', 'screen_view']);
    expect(new Set(q.map(e => e.session_id)).size).toBe(1);
    expect(q[1].screen).toBe('/swipe');
    expect(parseSession(session.getItem(SESSION_KEY))?.id).toBe(q[0].session_id);
  });

  it('screen_view porte l’écran précédent et le resto de /resto/<id>', () => {
    const { tracker, local } = setup();
    tracker.screenView('/swipe');
    tracker.screenView('/resto/osm-n1');
    const q = parseQueue(local.getItem(QUEUE_KEY));
    const last = q[q.length - 1];
    expect(last).toMatchObject({ name: 'screen_view', screen: '/resto/[id]', rest_id: 'osm-n1' });
    expect(last.props.from).toBe('/swipe');
    // les événements suivants héritent de l'écran courant
    tracker.track('open_card');
    expect(parseQueue(local.getItem(QUEUE_KEY)).pop()?.screen).toBe('/resto/[id]');
  });

  it('après 30 min d’inactivité : session_end daté de la dernière activité, puis nouvelle session', () => {
    const { tracker, local, advance } = setup();
    tracker.track('swipe_like');
    advance(60_000);
    tracker.track('swipe_pass');
    advance(SESSION_TIMEOUT_MS + 1);
    tracker.track('swipe_like');
    const q = parseQueue(local.getItem(QUEUE_KEY));
    expect(q.map(e => e.name)).toEqual(['session_start', 'swipe_like', 'swipe_pass', 'session_end', 'session_start', 'swipe_like']);
    const end = q[3];
    expect(end.session_id).toBe(q[0].session_id);
    expect(end.created_at).toBe(new Date(T0 + 60_000).toISOString());
    expect(end.props.duration_s).toBe(60);
    expect(q[4].session_id).not.toBe(q[0].session_id);
  });

  it('battement de cœur seulement si visible et utilisateur actif récemment', () => {
    const { tracker, local, advance } = setup();
    tracker.screenView('/swipe');
    expect(tracker.heartbeat(false)).toBe(false);
    advance(HEARTBEAT_MS);
    expect(tracker.heartbeat(true)).toBe(true);
    advance(IDLE_MS + 1);
    expect(tracker.heartbeat(true)).toBe(false); // inactif depuis trop longtemps
    tracker.noteActivity();
    expect(tracker.heartbeat(true)).toBe(true);
    const beats = parseQueue(local.getItem(QUEUE_KEY)).filter(e => e.name === 'heartbeat');
    expect(beats.length).toBe(2);
    expect(beats[0].props.s).toBe(HEARTBEAT_MS / 1000);
    expect(beats[0].screen).toBe('/swipe');
  });

  it('endSession envoie session_end une seule fois avec le temps actif', () => {
    const { tracker, local, advance } = setup();
    tracker.screenView('/swipe');
    advance(HEARTBEAT_MS);
    tracker.heartbeat(true);
    tracker.endSession('hidden');
    tracker.endSession('hidden');
    const ends = parseQueue(local.getItem(QUEUE_KEY)).filter(e => e.name === 'session_end');
    expect(ends.length).toBe(1);
    expect(ends[0].props).toMatchObject({ active_s: HEARTBEAT_MS / 1000, reason: 'hidden' });
  });

  it('envoi par lots dès le seuil, puis vide la file', async () => {
    const { tracker, sent } = setup();
    for (let i = 0; i < FLUSH_THRESHOLD; i++) tracker.track('swipe_like');
    await tracker.flush();
    expect(sent.length).toBeGreaterThan(0);
    expect(tracker.size()).toBe(0);
  });

  it('programme un envoi différé sous le seuil', () => {
    const timers: Array<() => void> = [];
    const { tracker } = setup({ setTimer: fn => timers.push(fn) });
    tracker.track('swipe_like');
    tracker.track('swipe_like');
    expect(timers.length).toBe(1);
  });

  it('sans session : la file attend', async () => {
    const { tracker, send } = setup({ hasSession: async () => false });
    tracker.track('swipe_like');
    await tracker.flush();
    expect(send).not.toHaveBeenCalled();
    expect(tracker.size()).toBe(2);
  });

  it('hors ligne : on garde la file et on réessaie, sans dépasser MAX_FAILURES', async () => {
    let online = false;
    const send = vi.fn(async (): Promise<SendResult> => (online ? 'ok' : 'retry'));
    const { tracker } = setup({ send });
    tracker.track('swipe_like');
    for (let i = 0; i < MAX_FAILURES + 3; i++) await tracker.flush();
    expect(send).toHaveBeenCalledTimes(MAX_FAILURES);
    expect(tracker.size()).toBe(2);
    online = true;
    tracker.resetFailures();
    await tracker.flush();
    expect(tracker.size()).toBe(0);
  });

  it('refus définitif : lot abandonné', async () => {
    const { tracker } = setup({ send: async () => 'drop' });
    tracker.track('swipe_like');
    await tracker.flush();
    expect(tracker.size()).toBe(0);
  });

  it('exception réseau : traitée comme un échec passager', async () => {
    const { tracker } = setup({
      send: async () => {
        throw new Error('offline');
      },
    });
    tracker.track('swipe_like');
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(tracker.size()).toBe(2);
  });

  it('la file survit à un rechargement (nouvelle instance)', () => {
    const a = setup();
    a.tracker.track('swipe_like');
    const b = createTracker({ ...a.deps, storage: a.local, sessionStorage: a.session });
    expect(b.size()).toBe(2);
  });

  it('clear vide la file stockée', () => {
    const { tracker, local } = setup();
    tracker.track('swipe_like');
    tracker.clear();
    expect(tracker.size()).toBe(0);
    expect(local.getItem(QUEUE_KEY)).toBeNull();
  });

  it('stockage indisponible : fonctionne en mémoire', () => {
    const { tracker } = setup({ storage: null, sessionStorage: null });
    expect(tracker.track('swipe_like')).toBe(true);
    expect(tracker.size()).toBe(2);
  });
});

describe('propriétés de swipe : identifiant du resto', () => {
  it('ajoute rest_id seulement s’il est bien formé, jamais le nom', async () => {
    const { swipeProps, openCardProps } = await import('../lib/usageProps');
    expect(swipeProps({ id: 'osm-n1', cuisine: 'Thaï', distanceMeters: 1200 })).toEqual({ cuisine: 'thai', distance_km: 1, rest_id: 'osm-n1' });
    expect(swipeProps({ cuisine: 'Thaï' })).toEqual({ cuisine: 'thai', distance_km: 0 });
    expect(openCardProps({ id: '<x>', cuisine: 'Pizza' }, 'swipe')).toEqual({ cuisine: 'pizza', from: 'swipe' });
    const ev = buildEvent('swipe_like', swipeProps({ id: 'osm-n1', cuisine: 'Thaï' }), { sessionId: 's', screen: '/swipe', now: T0 });
    expect(ev?.rest_id).toBe('osm-n1');
    expect(ev?.props).toEqual({ cuisine: 'thai', distance_km: 0 });
  });
});
