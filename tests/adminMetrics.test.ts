import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FUNNEL,
  buildFunnel,
  buildRetention,
  describeEvent,
  formatDuration,
  formatPct,
  isUuid,
  parseDays,
  parseSteps,
  rate,
} from '../lib/admin/metrics';

describe('taux', () => {
  it('calcule un ratio, null si dénominateur nul', () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(0, 0)).toBeNull();
    expect(rate(3, -1)).toBeNull();
    expect(rate(Number.NaN, 2)).toBeNull();
  });
  it('affiche un pourcentage lisible', () => {
    expect(formatPct(0.25)).toBe('25 %');
    expect(formatPct(0.1234)).toBe('12,3 %');
    expect(formatPct(1)).toBe('100 %');
    expect(formatPct(null)).toBe('—');
  });
});

describe('durées', () => {
  it('formate en s, min, h', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
    expect(formatDuration(3780)).toBe('1 h 03 min');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-3)).toBe('—');
  });
});

describe('paramètres', () => {
  it('période : 7, 30 ou 90 (30 par défaut)', () => {
    expect(parseDays('7')).toBe(7);
    expect(parseDays('90')).toBe(90);
    expect(parseDays('12')).toBe(30);
    expect(parseDays(null)).toBe(30);
  });
  it('étapes du funnel : noms valides, 2 à 8, éventuellement nom:écran', () => {
    expect(parseSteps('session_start, swipe_like ,open_card')).toEqual(['session_start', 'swipe_like', 'open_card']);
    expect(parseSteps('screen_view:/swipe,swipe_like')).toEqual(['screen_view:/swipe', 'swipe_like']);
    expect(parseSteps('solo')).toBeNull();
    expect(parseSteps('ok_name,Bad Name')).toBeNull();
    expect(parseSteps('a1,b2,c3,d4,e5,f6,g7,h8,i9')).toBeNull();
    expect(parseSteps(null)).toBeNull();
    expect(DEFAULT_FUNNEL.length).toBeGreaterThanOrEqual(3);
    expect(parseSteps(DEFAULT_FUNNEL.join(','))).toEqual(DEFAULT_FUNNEL);
  });
  it('uuid', () => {
    expect(isUuid('5f0c1f8e-4a2b-4c1d-9e3f-0123456789ab')).toBe(true);
    expect(isUuid('pas-un-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('funnel', () => {
  it('calcule conversion depuis l’étape précédente et depuis le début', () => {
    const f = buildFunnel([
      { step: 1, step_name: 'session_start', users: 200, median_s: null },
      { step: 2, step_name: 'swipe_like', users: 120, median_s: 30 },
      { step: 3, step_name: 'checkin', users: 12, median_s: 86400 },
    ]);
    expect(f.map(s => s.users)).toEqual([200, 120, 12]);
    expect(f[0].fromPrev).toBe(1);
    expect(f[1].fromPrev).toBe(0.6);
    expect(f[2].fromPrev).toBe(0.1);
    expect(f[2].fromStart).toBe(0.06);
    expect(f[1].dropped).toBe(80);
    expect(f[1].label).toBe('Like');
  });
  it('trie par étape et tolère les nombres en texte (Postgres bigint)', () => {
    const f = buildFunnel([
      { step: 2, step_name: 'b_b', users: '5' as unknown as number, median_s: null },
      { step: 1, step_name: 'a_a', users: '10' as unknown as number, median_s: null },
    ]);
    expect(f.map(s => s.name)).toEqual(['a_a', 'b_b']);
    expect(f[1].fromPrev).toBe(0.5);
  });
  it('funnel vide : taux nuls', () => {
    const f = buildFunnel([
      { step: 1, step_name: 'a_a', users: 0, median_s: null },
      { step: 2, step_name: 'b_b', users: 0, median_s: null },
    ]);
    expect(f[1].fromPrev).toBeNull();
  });
});

describe('rétention par cohorte', () => {
  it('taux J1/J7/J30 sur les seuls utilisateurs éligibles', () => {
    const r = buildRetention([
      { cohort: '2026-11-01', size: 10, d1: 4, d1_eligible: 10, d7: 2, d7_eligible: 10, d30: 0, d30_eligible: 0 },
    ]);
    expect(r[0].d1.rate).toBe(0.4);
    expect(r[0].d7.rate).toBe(0.2);
    expect(r[0].d30.rate).toBeNull(); // pas encore mesurable
  });
  it('moyenne pondérée de toutes les cohortes', () => {
    const rows = buildRetention([
      { cohort: '2026-11-01', size: 10, d1: 5, d1_eligible: 10, d7: 0, d7_eligible: 0, d30: 0, d30_eligible: 0 },
      { cohort: '2026-11-02', size: 30, d1: 5, d1_eligible: 30, d7: 0, d7_eligible: 0, d30: 0, d30_eligible: 0 },
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0].cohort).toBe('2026-11-02'); // plus récente d'abord
    const { totals } = { totals: buildRetention.totals(rows) };
    expect(totals.size).toBe(40);
    expect(totals.d1.rate).toBe(0.25);
    expect(totals.d7.rate).toBeNull();
  });
});

describe('timeline', () => {
  it('décrit les événements en français', () => {
    expect(describeEvent('swipe_like')).toBe('A liké un resto');
    expect(describeEvent('screen_view')).toBe('Écran affiché');
    expect(describeEvent('click', { label: 'Valider' })).toBe('Clic « Valider »');
    expect(describeEvent('mon_evenement')).toBe('mon_evenement');
  });
});
