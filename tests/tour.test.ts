import { describe, expect, it } from 'vitest';
import {
  DNA_SWIPE_GOAL, FRESH_TOUR, IDLE_TOUR, TOUR_STEPS, dnaProgress, normalizeTour, reduceTour, tourStepId,
  type TourEvent, type TourState,
} from '../lib/tour';

const run = (events: TourEvent[], from: TourState = FRESH_TOUR): TourState => events.reduce(reduceTour, from);

describe('tour : déroulé des 4 gestes', () => {
  it('suit l’ordre envie → swipe → favoris → fil, puis se termine', () => {
    let s = FRESH_TOUR;
    expect(tourStepId(s)).toBe('mood');
    s = run([{ type: 'mood' }], s);
    expect(tourStepId(s)).toBe('swipe');
    s = run([{ type: 'swipe', dir: 'left' }, { type: 'swipe', dir: 'right' }], s);
    expect(tourStepId(s)).toBe('favoris');
    s = run([{ type: 'route', path: '/wishlist' }, { type: 'next' }], s);
    expect(tourStepId(s)).toBe('fil');
    s = run([{ type: 'route', path: '/feed' }], s);
    expect(s.status).toBe('done');
  });

  it('l’étape swipe demande les deux sens, dans n’importe quel ordre', () => {
    const afterMood = run([{ type: 'mood' }]);
    const oneWay = run([{ type: 'swipe', dir: 'right' }, { type: 'swipe', dir: 'right' }], afterMood);
    expect(tourStepId(oneWay)).toBe('swipe');
    expect(oneWay.right).toBe(true);
    expect(oneWay.left).toBe(false);
    expect(tourStepId(run([{ type: 'swipe', dir: 'left' }], oneWay))).toBe('favoris');
  });

  it('un événement qui ne concerne pas l’étape est ignoré', () => {
    expect(run([{ type: 'swipe', dir: 'left' }, { type: 'route', path: '/feed' }, { type: 'next' }])).toEqual(FRESH_TOUR);
    const swipe = run([{ type: 'mood' }]);
    expect(run([{ type: 'mood' }, { type: 'route', path: '/wishlist' }], swipe)).toEqual(swipe);
  });

  it('l’étape favoris : toucher l’onglet montre le resto rangé, puis « suivant » continue', () => {
    const atFavoris = run([{ type: 'mood' }, { type: 'swipe', dir: 'left' }, { type: 'swipe', dir: 'right' }]);
    expect(run([{ type: 'next' }], atFavoris)).toEqual(atFavoris); // pas avant d'avoir ouvert Favoris
    const opened = run([{ type: 'route', path: '/wishlist' }], atFavoris);
    expect(opened.favoritesOpened).toBe(true);
    expect(tourStepId(opened)).toBe('favoris');
    expect(tourStepId(run([{ type: 'next' }], opened))).toBe('fil');
  });

  it('« passer » arrête le tour à tout moment et il ne reprend plus', () => {
    const skipped = run([{ type: 'mood' }, { type: 'skip' }]);
    expect(skipped.status).toBe('skipped');
    expect(run([{ type: 'swipe', dir: 'left' }, { type: 'swipe', dir: 'right' }], skipped)).toEqual(skipped);
  });

  it('« passer l’étape » avance d’un cran et finit le tour à la dernière', () => {
    expect(tourStepId(run([{ type: 'skipStep' }]))).toBe('swipe');
    const last = run(TOUR_STEPS.slice(1).map<TourEvent>(() => ({ type: 'skipStep' })).concat({ type: 'skipStep' }));
    expect(last.status).toBe('done');
  });

  it('« start » rejoue le tour depuis le début, même après la fin', () => {
    const done = run(TOUR_STEPS.map<TourEvent>(() => ({ type: 'skipStep' })));
    expect(done.status).toBe('done');
    expect(reduceTour(done, { type: 'start' })).toEqual(FRESH_TOUR);
  });

  it('un tour inactif ou terminé ignore tout sauf « start »', () => {
    expect(reduceTour(IDLE_TOUR, { type: 'mood' })).toBe(IDLE_TOUR);
    expect(reduceTour(IDLE_TOUR, { type: 'skip' })).toBe(IDLE_TOUR);
  });

  it('ne modifie jamais l’état d’origine', () => {
    const before = JSON.stringify(FRESH_TOUR);
    reduceTour(FRESH_TOUR, { type: 'mood' });
    expect(JSON.stringify(FRESH_TOUR)).toBe(before);
  });
});

describe('tour : état stocké et jauge', () => {
  it('relit un état corrompu sans planter', () => {
    expect(normalizeTour(null)).toEqual(IDLE_TOUR);
    expect(normalizeTour('x')).toEqual(IDLE_TOUR);
    expect(normalizeTour({ status: 'bizarre', step: 99, left: 'oui' })).toEqual({ ...IDLE_TOUR, step: TOUR_STEPS.length - 1 });
    expect(normalizeTour({ status: 'active', step: -3 }).step).toBe(0);
    expect(normalizeTour({ status: 'active', step: 1, left: true, right: true, favoritesOpened: true })).toEqual({
      status: 'active', step: 1, left: true, right: true, favoritesOpened: true,
    });
  });

  it('jauge de fin de tour : bornée entre 0 et l’objectif', () => {
    expect(dnaProgress(0)).toEqual({ done: 0, goal: DNA_SWIPE_GOAL, left: DNA_SWIPE_GOAL, ratio: 0 });
    expect(dnaProgress(4).left).toBe(DNA_SWIPE_GOAL - 4);
    expect(dnaProgress(999)).toEqual({ done: DNA_SWIPE_GOAL, goal: DNA_SWIPE_GOAL, left: 0, ratio: 1 });
    expect(dnaProgress(-5).done).toBe(0);
  });
});
