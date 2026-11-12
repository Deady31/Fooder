import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { closesAt, formatCloseTime, isOpenAt, parseOpeningHours, parisWallClock } from '../lib/openingHours';
import type { OsmRecord } from '../lib/osm';

// Lundi 9 novembre 2026 (heure locale)
const at = (day: number, h: number, m = 0) => new Date(2026, 10, 9 + day, h, m);
const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;

describe('isOpenAt', () => {
  const lunchDinner = 'Mo-Fr 12:00-14:30,19:00-22:30; Sa 19:00-23:00; Su off';

  it('ouvert dans une plage, fermé entre deux plages', () => {
    expect(isOpenAt(lunchDinner, at(MON, 13))).toBe(true);
    expect(isOpenAt(lunchDinner, at(MON, 16))).toBe(false);
    expect(isOpenAt(lunchDinner, at(MON, 20))).toBe(true);
  });

  it('bornes : ouverture incluse, fermeture exclue', () => {
    expect(isOpenAt(lunchDinner, at(MON, 12, 0))).toBe(true);
    expect(isOpenAt(lunchDinner, at(MON, 14, 29))).toBe(true);
    expect(isOpenAt(lunchDinner, at(MON, 14, 30))).toBe(false);
    expect(isOpenAt(lunchDinner, at(MON, 11, 59))).toBe(false);
  });

  it('jour de fermeture explicite ou non mentionné', () => {
    expect(isOpenAt(lunchDinner, at(SUN, 13))).toBe(false);
    expect(isOpenAt('Mo-Fr 12:00-14:00', at(SAT, 13))).toBe(false);
  });

  it('plage qui passe minuit : le lendemain matin est encore ouvert', () => {
    const h = 'Fr-Sa 18:00-02:00';
    expect(isOpenAt(h, at(FRI, 23))).toBe(true);
    expect(isOpenAt(h, at(SAT, 1))).toBe(true);
    expect(isOpenAt(h, at(SAT, 2))).toBe(false);
    expect(isOpenAt(h, at(SUN, 1))).toBe(true); // nuit de samedi à dimanche
    expect(isOpenAt(h, at(SUN, 3))).toBe(false);
    expect(isOpenAt(h, at(THU, 1))).toBe(false); // jeudi 1 h : la nuit de mercredi n'est pas couverte
  });

  it('11:00-24:00 et 00:00-24:00', () => {
    expect(isOpenAt('Mo-Su 11:00-24:00', at(MON, 23, 59))).toBe(true);
    expect(isOpenAt('Mo-Su 11:00-24:00', at(TUE, 0, 30))).toBe(false);
  });

  it('24/7', () => {
    expect(isOpenAt('24/7', at(WED, 3))).toBe(true);
    expect(closesAt('24/7', at(WED, 3))).toBeNull();
  });

  it('horaire sans jour = tous les jours', () => {
    expect(isOpenAt('11:30-14:00,18:30-22:00', at(SUN, 12))).toBe(true);
    expect(isOpenAt('11:30-14:00', at(SUN, 15))).toBe(false);
  });

  it('séparateurs variés : virgule+espace entre plages et entre règles', () => {
    expect(isOpenAt('Mo-Fr 12:00-14:00, 19:00-22:00', at(TUE, 20))).toBe(true);
    expect(isOpenAt('Mo-Fr 12:00-14:00, Sa 19:00-23:00, Su 12:00-15:00', at(SAT, 21))).toBe(true);
    expect(isOpenAt('Mo-Fr 12:00-14:00, Sa 19:00-23:00, Su 12:00-15:00', at(SUN, 13))).toBe(true);
  });

  it('jours fériés (PH) ignorés', () => {
    expect(isOpenAt('Mo-Su,PH 12:00-23:00', at(MON, 13))).toBe(true);
    expect(isOpenAt('Mo-Th 19:30-22:00; PH off', at(MON, 20))).toBe(true);
    expect(isOpenAt('Mo-Fr 11:00-14:00; PH 11:00-23:00', at(SAT, 12))).toBe(false);
    expect(isOpenAt('Tu-Su 12:00-19:00; PH closed', at(TUE, 13))).toBe(true);
    expect(isOpenAt('We-Sa 18:00-02:00,Su 14:00-23:00; PH unknown', at(WED, 20))).toBe(true);
  });

  it('une règle suivante remplace la précédente pour ses jours', () => {
    const h = 'Mo-Fr 09:00-18:00; We off';
    expect(isOpenAt(h, at(TUE, 10))).toBe(true);
    expect(isOpenAt(h, at(WED, 10))).toBe(false);
  });

  it('plages en ordre inversé de jours (Su-Th) et jour de semaine entre règles', () => {
    expect(isOpenAt('Su-Th 10:00-20:00', at(SUN, 12))).toBe(true);
    expect(isOpenAt('Su-Th 10:00-20:00', at(MON, 12))).toBe(true);
    expect(isOpenAt('Su-Th 10:00-20:00', at(FRI, 12))).toBe(false);
    expect(isOpenAt('Fr-Mo 10:00-20:00', at(SUN, 12))).toBe(true);
  });

  it('insensible à la casse et aux espaces superflus', () => {
    expect(isOpenAt('  mo-fr   12:00 - 14:00 ', at(MON, 13))).toBe(true);
  });

  it('inconnu (null) pour les entrées vides ou non parsables', () => {
    for (const bad of [undefined, null, '', '   ', 'sunrise-sunset', 'Mo-Fr 12:00-14:00 "sur rendez-vous"', 'Mo-Sa; Sa midday off', 'by appointment', 'Mo-Fr 25:00-26:00', 'Mo-Fr 12:00+', 'Mo-Fr 12:00-14:00 || Sa 10:00-12:00', 'Mo-We 11:00-23:00 open']) {
      expect(isOpenAt(bad as string | undefined, at(MON, 13)), String(bad)).toBeNull();
      expect(closesAt(bad as string | undefined, at(MON, 13)), String(bad)).toBeNull();
    }
  });

  it('accepte aussi une semaine déjà parsée (WeekHours)', () => {
    const week = parseOpeningHours('Mo-Fr 12:00-14:00')!;
    expect(isOpenAt(week, at(MON, 13))).toBe(true);
    expect(isOpenAt(week, at(MON, 15))).toBe(false);
    expect(isOpenAt(undefined, at(MON, 15))).toBeNull();
  });
});

describe('closesAt', () => {
  it('heure de fermeture de la plage en cours', () => {
    expect(closesAt('Mo-Fr 12:00-14:30,19:00-22:30', at(MON, 13))).toBe('14:30');
    expect(closesAt('Mo-Fr 12:00-14:30,19:00-22:30', at(MON, 20))).toBe('22:30');
  });

  it('null si fermé', () => {
    expect(closesAt('Mo-Fr 12:00-14:30', at(MON, 16))).toBeNull();
  });

  it('plage après minuit : 02:00', () => {
    expect(closesAt('Fr 18:00-02:00', at(FRI, 22))).toBe('02:00');
    expect(closesAt('Fr 18:00-02:00', at(SAT, 1))).toBe('02:00');
  });

  it('fusionne les plages qui se touchent', () => {
    expect(closesAt('Mo-Su 11:00-24:00', at(MON, 12))).toBe('00:00');
    expect(closesAt('Mo 12:00-15:00,15:00-18:00', at(MON, 13))).toBe('18:00');
    // minuit puis reprise à 00:00 le lendemain
    expect(closesAt('Mo-We 11:00-24:00; Tu 00:00-01:00', at(MON, 12))).toBe('01:00');
  });
});

describe('formatCloseTime', () => {
  it('formate en français', () => {
    expect(formatCloseTime('22:00')).toBe('22 h');
    expect(formatCloseTime('22:30')).toBe('22 h 30');
    expect(formatCloseTime('02:00')).toBe('2 h');
    expect(formatCloseTime('00:00')).toBe('minuit');
  });
});

describe('données réelles Toulouse', () => {
  const places = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'toulouse-places.json'), 'utf8')) as OsmRecord[];
  const withHours = places.filter(p => p.h);

  it('au moins 90 % des horaires renseignés sont compris', () => {
    const ok = withHours.filter(p => parseOpeningHours(p.h) !== undefined).length;
    const rate = ok / withHours.length;
    // eslint-disable-next-line no-console
    console.log(`[horaires] parsés : ${ok}/${withHours.length} = ${(rate * 100).toFixed(1)} %`);
    expect(withHours.length).toBeGreaterThan(500);
    expect(rate).toBeGreaterThan(0.9);
  });

  it('ne plante jamais et renvoie un booléen ou null', () => {
    const d = at(TUE, 13);
    for (const p of withHours) {
      const v = isOpenAt(p.h, d);
      expect(v === true || v === false || v === null).toBe(true);
      const c = closesAt(p.h, d);
      if (v !== true) expect(c).toBeNull();
      else if (c !== null) expect(c).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('un horaire non parsable n’est jamais déclaré ouvert ou fermé', () => {
    for (const p of withHours) {
      if (parseOpeningHours(p.h) === undefined) expect(isOpenAt(p.h, at(WED, 12))).toBeNull();
    }
  });
});

describe('parisWallClock', () => {
  const parts = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];

  it('hiver : UTC+1', () => {
    expect(parts(parisWallClock(new Date('2026-11-12T11:30:00Z')))).toEqual([2026, 11, 12, 12, 30]);
  });

  it('été : UTC+2', () => {
    expect(parts(parisWallClock(new Date('2026-07-14T10:30:00Z')))).toEqual([2026, 7, 14, 12, 30]);
  });

  it('autour de minuit : 23:30 UTC est déjà le lendemain à Paris', () => {
    expect(parts(parisWallClock(new Date('2026-11-12T23:30:00Z')))).toEqual([2026, 11, 13, 0, 30]);
    expect(parts(parisWallClock(new Date('2026-11-12T22:59:00Z')))).toEqual([2026, 11, 12, 23, 59]);
  });

  it('changement d’heure (29 mars 2026, 01:00 UTC : 02:00 -> 03:00)', () => {
    expect(parts(parisWallClock(new Date('2026-03-29T00:59:00Z')))).toEqual([2026, 3, 29, 1, 59]);
    expect(parts(parisWallClock(new Date('2026-03-29T01:00:00Z')))).toEqual([2026, 3, 29, 3, 0]);
  });

  it('changement d’heure d’automne (25 oct. 2026, 01:00 UTC : 03:00 -> 02:00)', () => {
    expect(parts(parisWallClock(new Date('2026-10-25T00:30:00Z')))).toEqual([2026, 10, 25, 2, 30]);
    expect(parts(parisWallClock(new Date('2026-10-25T01:30:00Z')))).toEqual([2026, 10, 25, 2, 30]);
  });

  it('alimente isOpenAt avec le jour et l’heure de Paris', () => {
    // dimanche 22:30 UTC = lundi 23:30 ? non : lundi 9 nov. 23:30 UTC = mardi 00:30 Paris
    const h = 'Mo 18:00-23:00; Tu 12:00-14:00';
    expect(isOpenAt(h, parisWallClock(new Date('2026-11-09T17:30:00Z')))).toBe(true); // lundi 18:30 Paris
    expect(isOpenAt(h, parisWallClock(new Date('2026-11-09T23:30:00Z')))).toBe(false); // mardi 00:30 Paris
    expect(isOpenAt(h, parisWallClock(new Date('2026-11-10T11:00:00Z')))).toBe(true); // mardi 12:00 Paris
  });
});
