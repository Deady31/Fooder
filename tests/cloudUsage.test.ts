import { describe, expect, it } from 'vitest';
import {
  BATCH_SIZE,
  KeyValueStore,
  MAX_FAILURES,
  MAX_QUEUE,
  OPT_KEY,
  QUEUE_KEY,
  SendResult,
  TrackerDeps,
  UsageRow,
  USAGE_EVENTS,
  buildRow,
  classifySendError,
  createUsageTracker,
  enqueue,
  parseQueue,
  readOptIn,
  sanitizeProps,
  takeBatch,
  writeOptIn,
} from '../lib/usage';

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

const row = (n: number): UsageRow => ({ name: 'swipe_like', props: { position: n } });

function setup(over: Partial<TrackerDeps> = {}) {
  const storage = new MemoryStore();
  const sent: UsageRow[][] = [];
  const timers: (() => void)[] = [];
  let result: SendResult = 'ok';
  const deps: TrackerDeps = {
    cloudEnabled: () => true,
    optedIn: () => true,
    hasSession: async () => true,
    send: async rows => {
      sent.push(rows);
      return result;
    },
    storage,
    setTimer: fn => timers.push(fn),
    ...over,
  };
  return { tracker: createUsageTracker(deps), storage, sent, timers, setResult: (r: SendResult) => (result = r) };
}

describe('liste blanche des événements', () => {
  it('accepte exactement les 9 événements prévus', () => {
    expect([...USAGE_EVENTS].sort()).toEqual(
      ['checkin', 'friend_added', 'group_joined', 'open_card', 'photo_posted', 'share', 'signup', 'swipe_like', 'swipe_pass'].sort()
    );
    for (const n of USAGE_EVENTS) expect(buildRow(n)).toEqual({ name: n, props: {} });
  });

  it('refuse tout autre événement ou type', () => {
    expect(buildRow('auth_code_sent')).toBeNull();
    expect(buildRow('SWIPE_LIKE')).toBeNull();
    expect(buildRow(42)).toBeNull();
    expect(buildRow(undefined)).toBeNull();
    expect(buildRow('swipe_like; drop table events')).toBeNull();
  });
});

describe('bornage des propriétés', () => {
  it('ne garde que les clés prévues pour l’événement', () => {
    expect(sanitizeProps('swipe_like', { cuisine: 'pizza', position: 3, email: 'a@b.fr', name: 'Chez Marcel' })).toEqual({ cuisine: 'pizza', position: 3 });
    expect(sanitizeProps('share', { cuisine: 'pizza' })).toEqual({});
  });

  it('refuse le texte libre, les majuscules, accents, espaces et e-mails', () => {
    expect(sanitizeProps('open_card', { cuisine: 'Chez Marcel' })).toEqual({});
    expect(sanitizeProps('open_card', { cuisine: 'crêperie' })).toEqual({});
    expect(sanitizeProps('open_card', { cuisine: 'a@b.fr' })).toEqual({});
    expect(sanitizeProps('open_card', { cuisine: 'x'.repeat(25) })).toEqual({});
    expect(sanitizeProps('open_card', { cuisine: '' })).toEqual({});
    expect(sanitizeProps('open_card', { cuisine: 'italien', from: 'map-1' })).toEqual({ cuisine: 'italien', from: 'map-1' });
  });

  it('refuse les valeurs qui ressemblent à un identifiant', () => {
    expect(sanitizeProps('friend_added', { method: '0f8fad5bd9cb469fa16570867728950e' })).toEqual({});
    expect(sanitizeProps('friend_added', { method: '0f8fad5b-d9cb-469f-a165-70867728950e' })).toEqual({});
  });

  it('borne et arrondit les nombres, refuse NaN et les mauvais types', () => {
    expect(sanitizeProps('swipe_like', { position: 3.7 })).toEqual({ position: 4 });
    expect(sanitizeProps('swipe_like', { position: 9e9 })).toEqual({ position: 100000 });
    expect(sanitizeProps('swipe_like', { position: NaN })).toEqual({});
    expect(sanitizeProps('swipe_like', { position: '3' })).toEqual({});
    expect(sanitizeProps('checkin', { photo: 'true', verdict: 'miam' })).toEqual({ verdict: 'miam' });
    expect(sanitizeProps('checkin', { photo: true })).toEqual({ photo: true });
  });

  it('tolère des props absentes ou invalides', () => {
    expect(sanitizeProps('share', undefined)).toEqual({});
    expect(sanitizeProps('share', null)).toEqual({});
    expect(sanitizeProps('share', ['card'])).toEqual({});
    expect(sanitizeProps('share', 'card')).toEqual({});
  });
});

describe('file d’attente', () => {
  it('ajoute sans modifier l’original', () => {
    const q = [row(1)];
    const next = enqueue(q, row(2));
    expect(q).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it('abandonne les plus anciens au-delà du maximum', () => {
    let q: UsageRow[] = [];
    for (let i = 0; i < 5; i++) q = enqueue(q, row(i), 3);
    expect(q.map(r => r.props.position)).toEqual([2, 3, 4]);
    expect(enqueue(Array.from({ length: MAX_QUEUE }, (_, i) => row(i)), row(999))).toHaveLength(MAX_QUEUE);
  });

  it('découpe en lots', () => {
    const q = Array.from({ length: BATCH_SIZE + 10 }, (_, i) => row(i));
    expect(takeBatch(q)).toHaveLength(BATCH_SIZE);
    expect(takeBatch(q, 3)).toHaveLength(3);
  });

  it('relit le stockage en revalidant chaque ligne', () => {
    const raw = JSON.stringify([row(1), { name: 'hack', props: {} }, { name: 'share', props: { kind: 'Texte libre', x: 1 } }, 7, null]);
    expect(parseQueue(raw)).toEqual([row(1), { name: 'share', props: {} }]);
    expect(parseQueue('pas du json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
  });
});

describe('classification des erreurs d’envoi', () => {
  it('distingue refus définitif et panne passagère', () => {
    expect(classifySendError(null)).toBe('ok');
    expect(classifySendError({ status: 400 })).toBe('drop');
    expect(classifySendError({ status: 403 })).toBe('drop');
    expect(classifySendError({ status: 401 })).toBe('retry');
    expect(classifySendError({ status: 429 })).toBe('retry');
    expect(classifySendError({ status: 503 })).toBe('retry');
    expect(classifySendError({ status: 0 })).toBe('retry');
  });
});

describe('suivi : no-op sans cloud ou si désactivé', () => {
  it('ne fait rien quand le cloud est absent', async () => {
    const { tracker, sent, storage, timers } = setup({ cloudEnabled: () => false });
    expect(tracker.track('swipe_like', { cuisine: 'pizza' })).toBe(false);
    await tracker.flush();
    expect(tracker.size()).toBe(0);
    expect(sent).toHaveLength(0);
    expect(storage.data.size).toBe(0);
    expect(timers).toHaveLength(0);
  });

  it('ne fait rien quand le réglage est désactivé', async () => {
    const { tracker, sent, storage } = setup({ optedIn: () => false });
    expect(tracker.track('swipe_like')).toBe(false);
    await tracker.flush();
    expect(sent).toHaveLength(0);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('ignore les événements hors liste', () => {
    const { tracker } = setup();
    expect(tracker.track('page_view')).toBe(false);
    expect(tracker.size()).toBe(0);
  });

  it('n’envoie plus rien dès que le réglage est coupé, même avec une file pleine', async () => {
    let on = true;
    const { tracker, sent } = setup({ optedIn: () => on });
    tracker.track('swipe_like');
    on = false;
    await tracker.flush();
    expect(sent).toHaveLength(0);
  });
});

describe('suivi : envoi groupé', () => {
  it('met en file, persiste, puis envoie en un lot et vide', async () => {
    const { tracker, sent, storage, timers } = setup();
    tracker.track('swipe_like', { cuisine: 'pizza', secret: 'x' });
    tracker.track('swipe_pass');
    expect(tracker.size()).toBe(2);
    expect(timers).toHaveLength(1); // un seul minuteur, pas un par événement
    expect(JSON.parse(storage.getItem(QUEUE_KEY)!)).toHaveLength(2);
    await tracker.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      { name: 'swipe_like', props: { cuisine: 'pizza' } },
      { name: 'swipe_pass', props: {} },
    ]);
    expect(tracker.size()).toBe(0);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('envoie automatiquement dès que le seuil est atteint, par lots bornés', async () => {
    const { tracker, sent } = setup();
    for (let i = 0; i < 20; i++) tracker.track('swipe_like', { position: i });
    await new Promise(r => setTimeout(r, 0));
    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(sent[0]).toHaveLength(20);
    expect(tracker.size()).toBe(0);
  });

  it('découpe une grosse file en plusieurs lots', async () => {
    const { tracker, sent } = setup({ hasSession: async () => false });
    for (let i = 0; i < 120; i++) tracker.track('swipe_like', { position: i });
    expect(tracker.size()).toBe(120);
    expect(sent).toHaveLength(0);
  });

  it('garde la file tant qu’il n’y a pas de session', async () => {
    let session = false;
    const { tracker, sent } = setup({ hasSession: async () => session });
    tracker.track('share', { kind: 'card' });
    await tracker.flush();
    expect(sent).toHaveLength(0);
    expect(tracker.size()).toBe(1);
    session = true;
    await tracker.flush();
    expect(sent).toHaveLength(1);
    expect(tracker.size()).toBe(0);
  });

  it('garde la file après un échec passager, la vide après un refus définitif', async () => {
    const a = setup();
    a.setResult('retry');
    a.tracker.track('share');
    await a.tracker.flush();
    expect(a.tracker.size()).toBe(1);
    a.setResult('ok');
    await a.tracker.flush();
    expect(a.tracker.size()).toBe(0);

    const b = setup();
    b.setResult('drop');
    b.tracker.track('share');
    await b.tracker.flush();
    expect(b.tracker.size()).toBe(0);
  });

  it('s’arrête après trop d’échecs consécutifs', async () => {
    const { tracker, sent, setResult } = setup();
    setResult('retry');
    tracker.track('share');
    for (let i = 0; i < MAX_FAILURES + 3; i++) await tracker.flush();
    expect(sent).toHaveLength(MAX_FAILURES);
    expect(tracker.size()).toBe(1);
  });

  it('reprend les envois après un nouveau track ou un retour en ligne', async () => {
    const { tracker, sent, setResult } = setup();
    setResult('retry');
    tracker.track('share');
    for (let i = 0; i < MAX_FAILURES + 2; i++) await tracker.flush();
    expect(sent).toHaveLength(MAX_FAILURES);

    setResult('ok');
    tracker.resetFailures();
    await tracker.flush();
    expect(sent).toHaveLength(MAX_FAILURES + 1);
    expect(tracker.size()).toBe(0);

    setResult('retry');
    tracker.track('share');
    for (let i = 0; i < MAX_FAILURES + 1; i++) await tracker.flush();
    const before = sent.length;
    setResult('ok');
    tracker.track('share');
    await tracker.flush();
    expect(sent.length).toBe(before + 1);
  });

  it('traite une exception d’envoi comme un échec passager', async () => {
    const { tracker } = setup({
      send: async () => {
        throw new Error('réseau');
      },
    });
    tracker.track('share');
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(tracker.size()).toBe(1);
  });

  it('conserve les événements arrivés pendant l’envoi', async () => {
    let release: (r: SendResult) => void = () => undefined;
    const { tracker } = setup({ send: () => new Promise<SendResult>(res => (release = res)) });
    tracker.track('share');
    const pending = tracker.flush();
    await new Promise(r => setTimeout(r, 0));
    tracker.track('swipe_like');
    release('ok');
    await pending;
    expect(tracker.size()).toBe(1);
  });

  it('reprend la file persistée au démarrage suivant', async () => {
    const first = setup();
    first.tracker.track('share', { kind: 'card' });
    const second = createUsageTracker({
      cloudEnabled: () => true,
      optedIn: () => true,
      hasSession: async () => true,
      send: async () => 'ok',
      storage: first.storage,
      setTimer: () => undefined,
    });
    expect(second.size()).toBe(1);
  });

  it('clear() vide la file et le stockage', () => {
    const { tracker, storage } = setup();
    tracker.track('share');
    tracker.clear();
    expect(tracker.size()).toBe(0);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('fonctionne sans stockage disponible', async () => {
    const { tracker, sent } = setup({ storage: null });
    tracker.track('share');
    await tracker.flush();
    expect(sent).toHaveLength(1);
  });
});

describe('réglage « mesures anonymes »', () => {
  it('est activé par défaut et seul « off » le désactive', () => {
    const s = new MemoryStore();
    expect(readOptIn(s)).toBe(true);
    writeOptIn(s, false);
    expect(s.getItem(OPT_KEY)).toBe('off');
    expect(readOptIn(s)).toBe(false);
    writeOptIn(s, true);
    expect(readOptIn(s)).toBe(true);
    expect(readOptIn(null)).toBe(true);
  });

  it('ne plante pas si le stockage lève une exception', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {
        throw new Error('bloqué');
      },
    };
    expect(readOptIn(broken)).toBe(true);
    expect(() => writeOptIn(broken, false)).not.toThrow();
  });
});
