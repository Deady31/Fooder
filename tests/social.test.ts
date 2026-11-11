import { describe, expect, it } from 'vitest';
import { decodePayload, encodePayload } from '../lib/social/codec';
import { FriendSnapshot, compactSnapshot, parseSnapshot } from '../lib/social/snapshot';
import { foodMatch } from '../lib/social/match';
import { GroupSession, groupResults, mergeGroups, parseGroup, withVote } from '../lib/social/group';
import { parseDefi } from '../lib/social/defi';
import { weekIndex, weeklyStreak, visitsThisWeek } from '../lib/streak';
import { isWeekendWindow, monthlyChallenges, weekendPicks, contributorTitles, bestTitle } from '../lib/rituals';
import { Restaurant } from '../data/mockRestaurants';
import { Visit } from '../lib/visits';

const snap = (over: Partial<FriendSnapshot> = {}): FriendSnapshot => ({
  v: 1, id: 'uabc', name: 'lea', avatar: { id: 'donut', bg: 'mint' }, level: 3, xp: 200,
  archetype: 'Explorateur', archetypeSticker: 'curry', cuisines: [['Italien', 4], ['Japonais', 2]],
  likes: [['r1', 'Pizza A', 'Italien'], ['r2', 'Sushi B', 'Japonais']], quartiers: ['Capitole', 'Carmes'],
  visits: 3, week: 2915, weekVisits: 1, streak: 2, photos: 1, at: 1_700_000_000_000, ...over,
});

describe('codec', () => {
  it('fait l’aller-retour d’un objet', async () => {
    const data = { v: 1, hello: 'Pâtes & crêpes ✨', n: [1, 2, 3] };
    const enc = await encodePayload(data);
    expect(enc).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    expect(await decodePayload(enc)).toEqual(data);
  });

  it('refuse les entrées invalides ou trop longues', async () => {
    expect(await decodePayload('')).toBeNull();
    expect(await decodePayload('x.abc')).toBeNull();
    expect(await decodePayload('j.<script>')).toBeNull();
    expect(await decodePayload('j.' + 'A'.repeat(20_000))).toBeNull();
    expect(await decodePayload('j.bm9wZQ')).toBeNull(); // « nope » n'est pas du JSON
  });
});

describe('robustesse des liens reçus', () => {
  it('rejette une « bombe » de décompression', async () => {
    const huge = await encodePayload({ v: 1, junk: 'a'.repeat(500_000) });
    expect(huge.length).toBeLessThan(12_000); // passe le filtre de longueur…
    expect(await decodePayload(huge)).toBeNull(); // …mais pas celui de la taille décompressée
  });

  it('ramène les dates futures à maintenant', () => {
    const s = parseSnapshot(snap({ at: 8e15 }));
    expect(s!.at).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
  });

  it('garde les votes les plus récents au-delà de 12 votants', () => {
    const base: GroupSession = {
      v: 1, id: 'gmany', title: 't', host: { id: 'h', name: 'h' }, at: 1,
      restos: [{ id: 'a', name: 'A', cuisine: '' }, { id: 'b', name: 'B', cuisine: '' }, { id: 'c', name: 'C', cuisine: '' }],
      votes: [],
    };
    let s = base;
    for (let i = 0; i < 14; i++) s = withVote(s, { voterId: `u${i}`, name: `n${i}`, likes: ['a'], at: i + 1 });
    expect(s.votes).toHaveLength(12);
    expect(s.votes.some(v => v.voterId === 'u13')).toBe(true);
    expect(s.votes.some(v => v.voterId === 'u0')).toBe(false);
  });
});

describe('snapshot', () => {
  it('accepte une carte valide', () => {
    expect(parseSnapshot(snap())?.name).toBe('lea');
  });

  it('rejette ou corrige les champs suspects', () => {
    expect(parseSnapshot({ ...snap(), v: 2 })).toBeNull();
    expect(parseSnapshot({ ...snap(), id: '../../etc' })).toBeNull();
    const s = parseSnapshot({ ...snap(), avatar: { id: 'hacker', bg: 'javascript:' }, level: 99, archetypeSticker: 'evil', name: 'x'.repeat(200) });
    expect(s?.avatar).toEqual({ id: 'burger', bg: 'bubblegum' });
    expect(s?.level).toBe(10);
    expect(s?.archetypeSticker).toBe('donut');
    expect(s?.name.length).toBe(20);
  });

  it('allège la carte pour le QR code', () => {
    const many = snap({ likes: Array.from({ length: 30 }, (_, i) => [`r${i}`, 'Un nom de restaurant très très long', 'Cuisine'] as [string, string, string]) });
    expect(compactSnapshot(many).likes.length).toBe(12);
  });
});

describe('foodMatch', () => {
  it('donne 100 pour deux profils identiques', () => {
    expect(foodMatch(snap(), snap({ id: 'u2' })).score).toBe(100);
  });

  it('reste bas pour des goûts opposés et propose une cuisine à découvrir', () => {
    const m = foodMatch(snap(), snap({ id: 'u2', cuisines: [['Burger', 5]], likes: [['r9', 'Burger C', 'Burger']], quartiers: ['Minimes'] }));
    expect(m.score).toBe(0);
    expect(m.toDiscover).toBe('Burger');
  });

  it('retourne null sans données', () => {
    expect(foodMatch(snap({ cuisines: [] }), snap()).score).toBeNull();
  });
});

describe('sessions de groupe', () => {
  const base: GroupSession = {
    v: 1, id: 'gabc123', title: 'Vendredi', host: { id: 'u1', name: 'lea' }, at: 1,
    restos: [{ id: 'a', name: 'A', cuisine: 'x' }, { id: 'b', name: 'B', cuisine: 'y' }, { id: 'c', name: 'C', cuisine: 'z' }],
    votes: [],
  };

  it('fusionne les votes et garde le plus récent par personne', () => {
    const s1 = withVote(base, { voterId: 'u1', name: 'lea', likes: ['a', 'b'], at: 10 });
    const s2 = withVote(base, { voterId: 'u2', name: 'tom', likes: ['b', 'zzz'], at: 11 });
    const s3 = withVote(base, { voterId: 'u1', name: 'lea', likes: ['b'], at: 12 });
    const merged = mergeGroups(mergeGroups(s1, s2), s3);
    expect(merged.votes).toHaveLength(2);
    expect(merged.votes.find(v => v.voterId === 'u2')?.likes).toEqual(['b']);
    const res = groupResults(merged);
    expect(res[0].resto.id).toBe('b');
    expect(res[0].perfect).toBe(true);
  });

  it('valide une session reçue', () => {
    expect(parseGroup(base)?.restos).toHaveLength(3);
    expect(parseGroup({ ...base, restos: base.restos.slice(0, 2) })).toBeNull();
    expect(parseGroup({ ...base, id: 'evil' })).toBeNull();
    const withBadVote = parseGroup({ ...base, votes: [{ voterId: 'u9', name: 'x', likes: ['a', 'nope'], at: 3 }] });
    expect(withBadVote?.votes[0].likes).toEqual(['a']);
  });
});

describe('défi', () => {
  it('valide un défi', () => {
    expect(parseDefi({ v: 1, id: 'dxyz', from: 'lea', restId: 'r1', name: 'Pizza A', hint: 'Italien, 10 min', at: 5 })?.hint).toBe('Italien, 10 min');
    expect(parseDefi({ v: 1, id: 'nope', from: 'lea', restId: 'r1', name: 'A' })).toBeNull();
  });
});

describe('série hebdomadaire', () => {
  const day = 86_400_000;
  const monday = new Date(2026, 10, 9, 12).getTime(); // lundi 9 nov. 2026

  it('regroupe lundi et dimanche dans la même semaine', () => {
    expect(weekIndex(monday)).toBe(weekIndex(monday + 6 * day));
    expect(weekIndex(monday + 7 * day)).toBe(weekIndex(monday) + 1);
  });

  it('compte les semaines consécutives sans casser la semaine en cours', () => {
    const visits = [monday - 14 * day, monday - 7 * day];
    const s = weeklyStreak(visits, monday);
    expect(s.current).toBe(2);
    expect(s.thisWeekDone).toBe(false);
  });

  it('utilise le joker pour une semaine manquée', () => {
    const visits = [monday - 21 * day, monday - 7 * day, monday];
    expect(weeklyStreak(visits, monday).current).toBe(3);
    expect(weeklyStreak(visits, monday).jokerUsed).toBe(true);
    expect(weeklyStreak(visits, monday, 0).current).toBe(2);
  });

  it('compte les visites de la semaine', () => {
    expect(visitsThisWeek([monday, monday + day, monday - 7 * day], monday + 2 * day)).toBe(2);
  });
});

describe('rituels', () => {
  const r = (id: string, sat?: [number, number][]): Restaurant => ({
    id, name: id, rating: 0, price: 0, distance: '', cuisine: 'x', image: '', address: '', description: '',
    hours: sat ? [[], [], [], [], [], sat, []] : undefined,
  });

  it('propose d’abord les coups de cœur ouverts samedi soir, jamais ceux déjà visités', () => {
    const visits: Visit[] = [{ restId: 'v', name: 'v', cuisine: 'x', quartier: null, at: 1, verdict: 'miam' }];
    const picks = weekendPicks([r('closed', [[720, 840]]), r('open', [[1140, 1380]]), r('unknown'), r('v', [[1140, 1380]])], visits);
    expect(picks.map(p => p.id)).toEqual(['open', 'unknown', 'closed']);
  });

  it('ouvre la fenêtre du jeudi 18 h au dimanche', () => {
    expect(isWeekendWindow(new Date(2026, 10, 12, 19))).toBe(true); // jeudi soir
    expect(isWeekendWindow(new Date(2026, 10, 12, 10))).toBe(false); // jeudi matin
    expect(isWeekendWindow(new Date(2026, 10, 10, 19))).toBe(false); // mardi
  });

  it('suit les défis du mois et les titres', () => {
    const now = new Date(2026, 10, 15);
    const v = (c: string, q: string): Visit => ({ restId: c, name: c, cuisine: c, quartier: q, at: now.getTime(), verdict: 'miam' });
    const ch = monthlyChallenges([v('a', 'Capitole'), v('b', 'Carmes'), v('c', 'Carmes')], [], now);
    expect(ch.find(c => c.id === 'world')?.progress).toBe(3);
    expect(ch.find(c => c.id === 'quartiers')?.progress).toBe(2);
    expect(bestTitle(contributorTitles([], 1))).toBe('Éclaireur');
    expect(bestTitle(contributorTitles([], 0))).toBe('Nouveau foodie');
  });
});
