import { describe, expect, it, vi } from 'vitest';
import {
  buildFeed,
  createPublishLock,
  isDemoPost,
  isVisitPost,
  miamCount,
  removeById,
  visitToPost,
} from '../components/feed/feedLogic';
import { FeedPost, seedPosts } from '../lib/feed';
import type { Visit } from '../lib/visits';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ME = { name: 'Toi', avatar: { id: 'burger', bg: 'bubblegum' } as FeedPost['author']['avatar'], level: 2 };

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: 'p1',
  author: ME,
  restaurantId: 'osm-n1',
  restaurantName: 'Chez Test',
  cuisine: 'Burger',
  sticker: 'burger',
  caption: '',
  verdict: 'miam',
  likes: 0,
  createdAt: NOW - HOUR,
  ...over,
});

const visit = (over: Partial<Visit> = {}): Visit => ({
  restId: 'osm-n1',
  name: 'Chez Test',
  cuisine: 'Burger',
  quartier: null,
  at: NOW - 2 * HOUR,
  verdict: 'miam',
  ...over,
});

describe('miamCount (B2 : pas de +1 en trop)', () => {
  it('post local ou de démo : le cœur de l’utilisateur s’ajoute', () => {
    expect(miamCount(42, false, false)).toBe(42);
    expect(miamCount(42, true, false)).toBe(43);
  });

  it('post en ligne aimé avant le chargement : le serveur compte déjà mon cœur', () => {
    expect(miamCount(5, true, true)).toBe(5);
  });

  it('post en ligne aimé avant le chargement puis retiré : -1', () => {
    expect(miamCount(5, false, true)).toBe(4);
  });

  it('post en ligne aimé pendant la session : +1', () => {
    expect(miamCount(5, true, false)).toBe(6);
  });

  it('ne descend jamais sous 0 et tolère les valeurs invalides', () => {
    expect(miamCount(0, false, true)).toBe(0);
    expect(miamCount(-3, false, false)).toBe(0);
    expect(miamCount(Number.NaN, true, false)).toBe(1);
    expect(miamCount(Number.POSITIVE_INFINITY, false, false)).toBe(0);
  });
});

describe('visitToPost', () => {
  it('transforme une visite en post marqué « mine » avec un id stable', () => {
    const p = visitToPost(visit(), ME);
    expect(p.id).toBe(`visit-osm-n1-${NOW - 2 * HOUR}`);
    expect(p.mine).toBe(true);
    expect(p.verdict).toBe('miam');
    expect(p.createdAt).toBe(NOW - 2 * HOUR);
    expect(p.likes).toBe(0);
    expect(isVisitPost(p)).toBe(true);
    expect(isDemoPost(p)).toBe(false);
  });
});

describe('buildFeed', () => {
  const seeds = seedPosts(NOW);

  it('sans aucune donnée réelle : seuls les exemples, tous marqués démo', () => {
    const feed = buildFeed({ remote: [], mine: [], visits: [], seeds, me: ME, now: NOW });
    expect(feed.length).toBe(seeds.length);
    expect(feed.every(isDemoPost)).toBe(true);
  });

  it('une visite confirmée apparaît en tête et fait disparaître les exemples', () => {
    const feed = buildFeed({ remote: [], mine: [], visits: [visit()], seeds, me: ME, now: NOW });
    expect(feed).toHaveLength(1);
    expect(isVisitPost(feed[0])).toBe(true);
    expect(feed.some(isDemoPost)).toBe(false);
  });

  it('un post local ou en ligne fait aussi disparaître les exemples', () => {
    expect(buildFeed({ remote: [], mine: [post({})], visits: [], seeds, me: ME, now: NOW }).some(isDemoPost)).toBe(false);
    expect(buildFeed({ remote: [post({ id: 'r', mine: false })], mine: [], visits: [], seeds, me: ME, now: NOW }).some(isDemoPost)).toBe(false);
  });

  it('la visite n’est pas doublée quand un post du même resto existe le même jour (la photo est sur le post)', () => {
    const mine = [post({ id: 'm1', photo: 'data:image/jpeg;base64,AAA', mine: true, createdAt: NOW - 2 * HOUR + 5_000 })];
    const feed = buildFeed({ remote: [], mine, visits: [visit()], seeds, me: ME, now: NOW });
    expect(feed.map(p => p.id)).toEqual(['m1']);
    expect(feed[0].photo).toBeDefined();
  });

  it('une visite d’un autre jour ou d’un autre resto reste affichée', () => {
    const mine = [post({ id: 'm1', mine: true, createdAt: NOW - 3 * DAY })];
    const feed = buildFeed({ remote: [], mine, visits: [visit()], seeds, me: ME, now: NOW });
    expect(feed.map(p => p.id).sort()).toEqual(['m1', `visit-osm-n1-${NOW - 2 * HOUR}`].sort());
  });

  it('mes éléments récents passent devant le fil de la ville, les anciens se mêlent par date', () => {
    const remote = [post({ id: 'r-new', mine: false, createdAt: NOW - 10 * 60_000 })];
    const fresh = visit({ restId: 'osm-n2', at: NOW - 3 * DAY });
    const old = visit({ restId: 'osm-n3', at: NOW - 30 * DAY });
    const feed = buildFeed({ remote, mine: [], visits: [old, fresh], seeds, me: ME, now: NOW });
    expect(feed[0].restaurantId).toBe('osm-n2');
    expect(feed[1].id).toBe('r-new');
    expect(feed[2].restaurantId).toBe('osm-n3');
  });

  it('un post local déjà présent en ligne n’est pas doublé', () => {
    const remote = [post({ id: 'same', mine: true })];
    const feed = buildFeed({ remote, mine: [post({ id: 'same', mine: true })], visits: [], seeds, me: ME, now: NOW });
    expect(feed).toHaveLength(1);
  });

  it('ne plante pas sur des données corrompues', () => {
    const feed = buildFeed({
      remote: [],
      mine: null as unknown as FeedPost[],
      visits: 'oops' as unknown as Visit[],
      seeds,
      me: ME,
      now: NOW,
    });
    expect(feed.every(isDemoPost)).toBe(true);
  });
});

describe('createPublishLock (double appui sur « Publier »)', () => {
  it('n’exécute l’action qu’une fois tant que le verrou n’est pas relâché', () => {
    const lock = createPublishLock();
    const action = vi.fn(() => true);
    expect(lock.run(action)).toBe(true);
    expect(lock.run(action)).toBe(false);
    expect(lock.run(action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('relâche le verrou si l’action échoue (stockage plein) pour permettre de réessayer', () => {
    const lock = createPublishLock();
    const action = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    lock.run(action);
    lock.run(action);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('relâche le verrou si l’action lève une erreur', () => {
    const lock = createPublishLock();
    expect(() => lock.run(() => { throw new Error('boom'); })).toThrow('boom');
    const action = vi.fn(() => true);
    lock.run(action);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('reset() permet une nouvelle publication (réouverture de la feuille)', () => {
    const lock = createPublishLock();
    const action = vi.fn(() => true);
    lock.run(action);
    lock.reset();
    lock.run(action);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe('removeById', () => {
  it('retire sans muter la liste d’origine', () => {
    const list = [post({ id: 'a' }), post({ id: 'b' })];
    const next = removeById(list, 'a');
    expect(next.map(p => p.id)).toEqual(['b']);
    expect(list).toHaveLength(2);
  });
});
