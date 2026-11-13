import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildReverseUrl,
  buildSearchUrl,
  createAddressClient,
  createDebouncer,
  movedEnough,
  parseReverse,
  parseSearch,
  streetCase,
} from '../lib/geo/address';
import { restaurantFullAddress, restaurantStreet, distanceLabel, googleMapsInfoUrl, googleMapsDirectionsUrl } from '../lib/geo/format';

// Réponses d'exemple de la Base Adresse Nationale (format réel, raccourci). Aucun appel réseau.
const REVERSE_HOUSE = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1.446012, 43.604601] },
    properties: { label: '12 Rue d’Alsace-Lorraine 31000 Toulouse', name: '12 Rue d’Alsace-Lorraine', housenumber: '12', street: 'Rue d’Alsace-Lorraine', postcode: '31000', city: 'Toulouse', type: 'housenumber', id: '31555_0123_00012', distance: 8, score: 0.99 },
  }],
};
const REVERSE_LOCALITY = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1.444639, 43.604468] },
    properties: { type: 'locality', name: 'Rue Ernest Roschach', postcode: '31000', city: 'Toulouse', id: '31555_bq7my5', label: 'Rue Ernest Roschach 31000 Toulouse' },
  }],
};
const SEARCH = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1.099, 49.438] }, properties: { label: '12 Rue Alsace Lorraine 76000 Rouen', name: '12 Rue Alsace Lorraine', postcode: '76000', city: 'Rouen', type: 'housenumber', id: 'r1' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1.446, 43.6046] }, properties: { label: '12 Rue d’Alsace-Lorraine 31000 Toulouse', name: '12 Rue d’Alsace-Lorraine', postcode: '31000', city: 'Toulouse', type: 'housenumber', id: 't1' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1.446, 43.6046] }, properties: { label: 'doublon', name: 'doublon', postcode: '31000', city: 'Toulouse', type: 'housenumber', id: 't1' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: ['x', 2] }, properties: { name: 'cassé', id: 'bad' } },
  ],
};

describe('lecture pure des reponses BAN', () => {
  it('geocodage inverse : numero et rue, casse francaise', () => {
    const a = parseReverse(REVERSE_HOUSE)!;
    expect(a.short).toBe('12 rue d’Alsace-Lorraine');
    expect(a.label).toBe('12 rue d’Alsace-Lorraine, 31000 Toulouse');
    expect(a.coords).toEqual({ lat: 43.604601, lng: 1.446012 });
    expect(a.kind).toBe('housenumber');
  });

  it('geocodage inverse sans numero (lieu-dit, place)', () => {
    expect(parseReverse(REVERSE_LOCALITY)!.short).toBe('rue Ernest Roschach');
  });

  it('reponses vides ou invalides : null, jamais d exception', () => {
    expect(parseReverse({ features: [] })).toBeNull();
    expect(parseReverse(null)).toBeNull();
    expect(parseReverse('oups')).toBeNull();
    expect(parseReverse({ features: [{ geometry: null, properties: {} }] })).toBeNull();
  });

  it('recherche : Haute-Garonne d abord, doublons et entrees cassees ecartes, 5 max', () => {
    const list = parseSearch(SEARCH);
    expect(list.map(a => a.id)).toEqual(['t1', 'r1']);
    expect(parseSearch({ features: Array.from({ length: 9 }, (_, i) => ({ geometry: { coordinates: [1.44, 43.6] }, properties: { name: `${i} Rue A`, id: `i${i}`, postcode: '31000', city: 'Toulouse' } })) })).toHaveLength(5);
    expect(parseSearch(undefined)).toEqual([]);
  });

  it('casse des types de voie', () => {
    expect(streetCase('3 Rue Genty Magre')).toBe('3 rue Genty Magre');
    expect(streetCase('9 Pl. du Capitole')).toBe('9 place du Capitole');
    expect(streetCase('197 Rte de Saint-Simon')).toBe('197 route de Saint-Simon');
    expect(streetCase('21 Boulevard Armand-Duportal')).toBe('21 boulevard Armand-Duportal');
    expect(streetCase('Allées Jean Jaurès')).toBe('allées Jean Jaurès');
    expect(streetCase('La Méridienne')).toBe('La Méridienne');
  });
});

describe('URL envoyees au service public (coordonnees arrondies)', () => {
  it('inverse : 4 decimales (~10 m), lon puis lat', () => {
    expect(buildReverseUrl({ lat: 43.60460123, lng: 1.44601987 })).toBe('https://api-adresse.data.gouv.fr/reverse/?lon=1.446&lat=43.6046&limit=1');
  });

  it('recherche : requete encodee, 3 caracteres minimum, biais de position a 2 decimales', () => {
    expect(buildSearchUrl('ab', null)).toBeNull();
    expect(buildSearchUrl('  12 rue d’alsace ', { lat: 43.60461, lng: 1.44429 })).toBe(
      'https://api-adresse.data.gouv.fr/search/?q=12%20rue%20d%E2%80%99alsace&limit=10&lat=43.6&lon=1.44',
    );
    expect(buildSearchUrl('capitole', null)).toBe('https://api-adresse.data.gouv.fr/search/?q=capitole&limit=10');
  });
});

describe('client adresse : cache, seuil de 30 m, delai, repli', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const okFetch = (body: unknown) => vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);

  it('movedEnough : seuil de 30 m', () => {
    expect(movedEnough(null, { lat: 43.6, lng: 1.44 })).toBe(true);
    expect(movedEnough({ lat: 43.6, lng: 1.44 }, { lat: 43.6001, lng: 1.44 })).toBe(false); // ~11 m
    expect(movedEnough({ lat: 43.6, lng: 1.44 }, { lat: 43.6005, lng: 1.44 })).toBe(true); // ~56 m
  });

  it('ne redemande pas si la position a bouge de moins de 30 m', async () => {
    const f = okFetch(REVERSE_HOUSE);
    const client = createAddressClient({ fetch: f });
    const a = await client.reverse({ lat: 43.6046, lng: 1.446 });
    const b = await client.reverse({ lat: 43.60465, lng: 1.44605 });
    expect(a?.short).toBe('12 rue d’Alsace-Lorraine');
    expect(b).toEqual(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('cache memoire de la recherche', async () => {
    const f = okFetch(SEARCH);
    const client = createAddressClient({ fetch: f });
    await client.search('alsace lorraine', null);
    await client.search('Alsace Lorraine ', null);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('echec reseau ou HTTP : repli propre (null / liste vide)', async () => {
    const boom = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const client = createAddressClient({ fetch: boom });
    expect(await client.reverse({ lat: 43.6, lng: 1.44 })).toBeNull();
    expect(await client.search('capitole', null)).toEqual([]);
    const http = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response);
    expect(await createAddressClient({ fetch: http }).reverse({ lat: 43.6, lng: 1.44 })).toBeNull();
  });

  it('abandonne apres 4 s', async () => {
    let aborted = false;
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('abort')); });
    }));
    const client = createAddressClient({ fetch: hang });
    const p = client.reverse({ lat: 43.6, lng: 1.44 });
    await vi.advanceTimersByTimeAsync(3999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBeNull();
    expect(aborted).toBe(true);
  });

  it('debounce de 300 ms : seul le dernier appel part', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 300);
    d.call('a');
    vi.advanceTimersByTime(200);
    d.call('ab');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('ab');
    d.call('abc');
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('adresse du restaurant (carte et fiche)', () => {
  it('rue et numero quand l adresse existe', () => {
    expect(restaurantStreet({ address: '13 Rue Léon Gambetta, 31000', lat: 43.6, lng: 1.44 })).toBe('13 rue Léon Gambetta');
    expect(restaurantStreet({ address: '9 Pl. du Capitole, 31000, Toulouse' })).toBe('9 place du Capitole');
    expect(restaurantStreet({ address: 'Place Lange, Toulouse' })).toBe('place Lange');
  });

  it('repli quartier seulement si pas d adresse', () => {
    expect(restaurantStreet({ address: 'Quartier Carmes, Toulouse' })).toBeNull();
    expect(restaurantStreet({ address: 'Toulouse' })).toBeNull();
    expect(restaurantStreet({ address: '' })).toBeNull();
  });

  it('adresse complete lisible', () => {
    expect(restaurantFullAddress({ address: '9 Pl. du Capitole, 31000, Toulouse' })).toBe('9 place du Capitole, 31000 Toulouse');
    expect(restaurantFullAddress({ address: '21 Boulevard Armand-Duportal, 31000 Toulouse' })).toBe('21 boulevard Armand-Duportal, 31000 Toulouse');
  });

  it('distance : honnete quand la position est le centre par defaut', () => {
    expect(distanceLabel(1234, 'gps')).toBe('1,2 km');
    expect(distanceLabel(340, 'manual')).toBe('340 m');
    expect(distanceLabel(1234, 'default')).toBe('~1,2 km du centre');
  });
});

describe('liens Google Maps (sans API payante)', () => {
  const rest = { name: 'Chez Émile', address: '13 Place Saint-Georges, 31000, Toulouse', lat: 43.6, lng: 1.447 };
  it('Plus d informations : recherche nom + adresse encodes', () => {
    expect(googleMapsInfoUrl(rest)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Chez%20%C3%89mile%2013%20place%20Saint-Georges%2C%2031000%20Toulouse',
    );
  });
  it('ajoute query_place_id seulement s il est valide', () => {
    expect(googleMapsInfoUrl(rest, 'ChIJ_abcdefgh123')).toMatch(/&query_place_id=ChIJ_abcdefgh123$/);
    expect(googleMapsInfoUrl(rest, 'bad id"><')).not.toMatch(/query_place_id/);
  });
  it('itineraire a pied par coordonnees', () => {
    expect(googleMapsDirectionsUrl(rest)).toBe('https://www.google.com/maps/dir/?api=1&destination=43.6,1.447&travelmode=walking');
  });
});
