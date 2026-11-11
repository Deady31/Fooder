import { Restaurant } from '../data/mockRestaurants';
import { Verdict } from './feed';
import { quartierFor } from './quartiers';
import { readJson, writeJson } from './store';

/** Une visite confirmée par l'utilisateur (« J'y suis allé »). */
export interface Visit {
  restId: string;
  name: string;
  cuisine: string;
  quartier: string | null;
  at: number;
  verdict: Verdict;
}

/** Question « Tu y es allé ? » programmée après un like. */
export interface Checkin {
  restId: string;
  name: string;
  cuisine: string;
  lat?: number;
  lng?: number;
  dueAt: number;
  status: 'pending' | 'done' | 'dismissed';
}

export const VISITS_KEY = 'fooder_visits';
export const CHECKINS_KEY = 'fooder_checkins';

const HOUR = 3_600_000;
export const CHECKIN_DELAY = 20 * HOUR;
export const SNOOZE_DELAY = 72 * HOUR;
const MAX_CHECKINS = 60;

export const readVisits = (): Visit[] => readJson<Visit[]>(VISITS_KEY, []);
export const readCheckins = (): Checkin[] => readJson<Checkin[]>(CHECKINS_KEY, []);

export function hasVisited(restId: string, visits: Visit[] = readVisits()): boolean {
  return visits.some(v => v.restId === restId);
}

/** Programme la question « Tu y es allé ? » pour un resto liké (une seule fois par resto). */
export function queueCheckin(rest: Restaurant, now: number = Date.now()): void {
  const list = readCheckins();
  if (list.some(c => c.restId === rest.id) || hasVisited(rest.id)) return;
  const next: Checkin = {
    restId: rest.id,
    name: rest.name,
    cuisine: rest.cuisine,
    lat: rest.lat,
    lng: rest.lng,
    dueAt: now + CHECKIN_DELAY,
    status: 'pending',
  };
  writeJson(CHECKINS_KEY, [...list, next].slice(-MAX_CHECKINS));
}

export function dueCheckins(list: Checkin[], now: number = Date.now()): Checkin[] {
  return list.filter(c => c.status === 'pending' && c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}

function updateCheckin(restId: string, patch: Partial<Checkin>): void {
  writeJson(
    CHECKINS_KEY,
    readCheckins().map(c => (c.restId === restId ? { ...c, ...patch } : c))
  );
}

export const snoozeCheckin = (restId: string, now: number = Date.now()): void => updateCheckin(restId, { dueAt: now + SNOOZE_DELAY });
export const dismissCheckin = (restId: string): void => updateCheckin(restId, { status: 'dismissed' });

export interface VisitInput {
  restId: string;
  name: string;
  cuisine: string;
  lat?: number;
  lng?: number;
}

/** Enregistre une visite. Retourne la liste à jour (une visite par resto et par jour au maximum). */
export function addVisit(input: VisitInput, verdict: Verdict, now: number = Date.now()): Visit[] {
  const visits = readVisits();
  const day = new Date(now).toDateString();
  if (visits.some(v => v.restId === input.restId && new Date(v.at).toDateString() === day)) return visits;
  const quartier = input.lat !== undefined && input.lng !== undefined ? quartierFor(input.lat, input.lng) : null;
  const next = [...visits, { restId: input.restId, name: input.name, cuisine: input.cuisine, quartier, at: now, verdict }];
  writeJson(VISITS_KEY, next);
  updateCheckin(input.restId, { status: 'done' });
  return next;
}

export function visitedQuartiers(visits: Visit[]): Set<string> {
  return new Set(visits.map(v => v.quartier).filter((q): q is string => Boolean(q)));
}
