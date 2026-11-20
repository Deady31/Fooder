import { describe, expect, it } from 'vitest';
import {
  banKey, banResultFrom, checkBan, composeAddress, decideAddress, extractAddressesFromHtml, flattenSirene, formatSireneAddress,
  nameSimilarity, parseCsv, pickSirene, restoreAccents, titleCaseFr, toCsv,
} from '../scripts/lib/addressVerify.mjs';

const fiche = { id: 'osm-x', n: 'La Bonita', la: 43.5909, ln: 1.4396 };
const ban = (over = {}) => ({ label: '', score: 0.95, type: 'housenumber', name: '112 Grande Rue Saint-Michel', postcode: '31400', city: 'Toulouse', lat: 43.5909, lng: 1.4396, status: 'ok', ...over });

describe('CSV', () => {
  it('lit les guillemets, les virgules et les doubles guillemets', () => {
    const rows = parseCsv('id,adresse,result_label\na1,"2 Route d\'Espagne, 31100, Toulouse","dit ""bonjour"""\na2,x,y\n');
    expect(rows).toEqual([
      { id: 'a1', adresse: "2 Route d'Espagne, 31100, Toulouse", result_label: 'dit "bonjour"' },
      { id: 'a2', adresse: 'x', result_label: 'y' },
    ]);
  });

  it('écrit puis relit sans perte', () => {
    const rows = [{ id: 'a', adresse: 'Rue A, 31000, Toulouse' }, { id: 'b', adresse: 'avec "guillemets"' }];
    expect(parseCsv(toCsv(['id', 'adresse'], rows))).toEqual(rows);
  });

  it('gère les fins de ligne Windows', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('BAN : vérification de position', () => {
  it('accepte une adresse à moins de 150 m, avec sa précision', () => {
    expect(checkBan(ban(), fiche)).toMatchObject({ ok: true, precision: 'numero' });
    expect(checkBan(ban({ type: 'street' }), fiche)).toMatchObject({ ok: true, precision: 'rue' });
  });

  it('refuse un écart supérieur à 150 m (coord_mismatch)', () => {
    const far = checkBan(ban({ lat: 43.5909 + 0.0018 }), fiche); // ~200 m
    expect(far).toMatchObject({ ok: false, why: 'coord_mismatch' });
    expect(far.dist).toBeGreaterThan(150);
  });

  it('accepte un score bas quand la position concorde à 60 m ou moins (RD 813), pas au-delà', () => {
    expect(checkBan(ban({ score: 0.45, lat: 43.5909 + 0.0002 }), fiche).ok).toBe(true); // ~22 m
    expect(checkBan(ban({ score: 0.45, lat: 43.5909 + 0.0008 }), fiche).why).toBe('score_faible'); // ~90 m
    expect(checkBan(ban({ score: 0.3 }), fiche).why).toBe('score_faible'); // sous le plancher
  });

  it('refuse un score faible, une commune seule et un échec de géocodage', () => {
    expect(checkBan(ban({ score: 0.3 }), fiche).why).toBe('score_faible');
    expect(checkBan(ban({ type: 'municipality' }), fiche).why).toBe('type_trop_vague');
    expect(checkBan(ban({ status: 'skipped', lat: null, lng: null }), fiche).why).toBe('non_geocode');
    expect(checkBan(null, fiche).why).toBe('non_geocode');
  });

  it('convertit une ligne CSV de la BAN', () => {
    const r = banResultFrom({ result_label: 'x', result_score: '0.98', result_type: 'housenumber', result_name: '2 Route', result_postcode: '31100', result_city: 'Toulouse', latitude: '43.579', longitude: '1.4235', result_status: 'ok' });
    expect(r).toMatchObject({ score: 0.98, lat: 43.579, lng: 1.4235, type: 'housenumber' });
    expect(banResultFrom({ latitude: '', longitude: '', result_status: 'skipped' }).lat).toBeNull();
  });

  it('même clé de cache malgré accents, casse et espaces', () => {
    expect(banKey('  2 Route  d’Espagne, 31100 ')).toBe(banKey('2 route d’espagne, 31100'));
    expect(banKey('Labège')).toBe(banKey('LABEGE'));
  });
});

describe('adresse affichée', () => {
  it('reprend les accents du texte d’origine quand la BAN les a perdus', () => {
    expect(restoreAccents('269 La Meridienne', '269 La Méridienne, 31670, Labège')).toBe('269 La Méridienne');
    expect(restoreAccents('2 Rue Lafayette', 'x')).toBe('2 Rue Lafayette');
  });

  it('compose « numéro rue, code postal, commune »', () => {
    expect(composeAddress(ban(), '')).toBe('112 Grande Rue Saint-Michel, 31400, Toulouse');
  });
});

describe('noms et SIRENE', () => {
  it('ignore casse, accents, mots vides et formes juridiques', () => {
    expect(nameSimilarity('La Bonita', 'LA BONITA SARL')).toBe(1);
    expect(nameSimilarity('Tasty Crousty', 'TASTY CROUSTY')).toBe(1);
    expect(nameSimilarity('Le Café de l’Été', 'CAFE ETE')).toBe(1);
  });

  it('refuse des noms différents ou sans mot commun solide', () => {
    expect(nameSimilarity('Tasty Crousty', 'Crousty One')).toBeLessThan(0.8);
    expect(nameSimilarity('Burger King', 'Quick')).toBe(0);
    expect(nameSimilarity('', 'Quick')).toBe(0);
  });

  const sirene = {
    results: [
      { siren: '1', nom_complet: 'TASTY CROUSTY (TC)', matching_etablissements: [{ siret: '11', adresse: '23 RUE DU TAUR 31000 TOULOUSE', code_postal: '31000', libelle_commune: 'TOULOUSE', latitude: '43.60601', longitude: '1.44251', etat_administratif: 'A', activite_principale: '56.10C' }] },
      { siren: '2', nom_complet: 'TASTY CROUSTY', matching_etablissements: [{ siret: '22', adresse: '4 RUE MORTE 31300 TOULOUSE', code_postal: '31300', libelle_commune: 'TOULOUSE', latitude: '43.5808', longitude: '1.4246', etat_administratif: 'F', activite_principale: '56.10C' }] },
    ],
  };

  it('rapproche un établissement actif proche de la fiche et formate son adresse', () => {
    const pick = pickSirene(flattenSirene(sirene), { n: 'Tasty Crousty', la: 43.606, ln: 1.4425 });
    expect(pick).toMatchObject({ text: '23 Rue du Taur, 31000, Toulouse', siret: '11' });
    expect(pick.dist).toBeLessThan(200);
  });

  it('ignore un établissement fermé, trop loin ou au nom différent', () => {
    expect(pickSirene(flattenSirene(sirene), { n: 'Tasty Crousty', la: 43.5808, ln: 1.4246 })).toBeNull(); // fermé
    expect(pickSirene(flattenSirene(sirene), { n: 'Tasty Crousty', la: 43.62, ln: 1.4425 })).toBeNull(); // trop loin
    expect(pickSirene(flattenSirene(sirene), { n: 'Autre Nom', la: 43.606, ln: 1.4425 })).toBeNull();
  });

  it('ignore un établissement non diffusible (adresse masquée) sans planter', () => {
    const masked = flattenSirene({ results: [{ siren: '3', nom_complet: 'TASTY CROUSTY', matching_etablissements: [{ siret: '33', adresse: '[NON-DIFFUSIBLE]', code_postal: '[NON-DIFFUSIBLE]', libelle_commune: '[NON-DIFFUSIBLE]', latitude: '43.606', longitude: '1.4425', etat_administratif: 'A' }] }] });
    expect(() => pickSirene(masked, { n: 'Tasty Crousty', la: 43.606, ln: 1.4425 })).not.toThrow();
    expect(pickSirene(masked, { n: 'Tasty Crousty', la: 43.606, ln: 1.4425 })).toBeNull();
  });

  it('met en forme une adresse SIRENE en majuscules', () => {
    expect(titleCaseFr('1-2 1 PLACE DU CAPITOLE')).toBe('1-2 1 Place du Capitole');
    expect(formatSireneAddress({ adresse: "5 RUE D'ESPAGNE 31100 TOULOUSE", postcode: '31100', city: 'TOULOUSE' })).toBe("5 Rue d'Espagne, 31100, Toulouse");
  });
});

describe('site web', () => {
  it('lit le JSON-LD PostalAddress', () => {
    const html = `<script type="application/ld+json">{"@type":"Restaurant","address":{"@type":"PostalAddress","streetAddress":"12 Rue Lafayette","postalCode":"31000","addressLocality":"Toulouse"}}</script>`;
    expect(extractAddressesFromHtml(html)).toEqual(['12 Rue Lafayette, 31000, Toulouse']);
  });

  it('lit la liste des agences d’une chaîne écrite en clair', () => {
    const html = '<p>Tasty Crousty - Paris 20 63 Boulevard Davout, 75020 Paris</p><p>Tasty Crousty - Toulouse Capitole 35 Rue du Taur, 31000 Toulouse</p><p>Tasty Crousty - Toulouse 31 Avenue de Muret, 31300 Toulouse</p><script>var x="12 Rue Cachee, 31000 Toulouse"</script>';
    expect(extractAddressesFromHtml(html)).toEqual(['35 Rue du Taur, 31000, Toulouse', '31 Avenue de Muret, 31300, Toulouse']);
  });

  it('lit la balise address et ignore le texte sans code postal', () => {
    expect(extractAddressesFromHtml('<address>3 Rue X<br>31000 Toulouse</address>')).toEqual(['3 Rue X 31000 Toulouse']);
    expect(extractAddressesFromHtml('<address>Quelque part</address>')).toEqual([]);
    expect(extractAddressesFromHtml('<script type="application/ld+json">{pas du json</script>')).toEqual([]);
  });
});

describe('décision', () => {
  it('prend la première source validée selon la précédence OSM, Overture, SIRENE, site', () => {
    const r = decideAddress(fiche, [
      { src: 'overture', text: '112 Grande Rue Saint-Michel, 31400, Toulouse', ban: ban() },
      { src: 'osm', text: '110 Grande Rue Saint-Michel, 31400, Toulouse', ban: ban({ name: '110 Grande Rue Saint-Michel' }) },
    ]);
    expect(r).toMatchObject({ av: 'ok', src: 'osm+ban', p: 'numero', a: '110 Grande Rue Saint-Michel, 31400, Toulouse' });
  });

  it('passe à la source suivante quand la première est en désaccord de position', () => {
    const r = decideAddress(fiche, [
      { src: 'osm', text: 'x', ban: ban({ lat: 43.6 }) },
      { src: 'overture', text: 'y', ban: ban() },
    ]);
    expect(r.src).toBe('overture+ban');
  });

  it('n’invente jamais d’adresse : aucune source ou toutes refusées donnent « none »', () => {
    expect(decideAddress(fiche, [])).toEqual({ a: null, av: 'none', src: 'aucune_source' });
    expect(decideAddress(fiche, [{ src: 'osm', text: 'x', ban: ban({ lat: 43.6 }) }])).toMatchObject({ av: 'none', src: 'coord_mismatch', a: null });
    expect(decideAddress(fiche, [{ src: 'osm', text: 'x', ban: null }])).toMatchObject({ av: 'none', src: 'non_geocode' });
  });

  it('accepte un établissement SIRENE dont la position concorde mais que la BAN ne géocode pas', () => {
    expect(decideAddress(fiche, [{ src: 'sirene', text: '23 Rue du Taur, 31000, Toulouse', ban: null, sireneGeo: true }])).toMatchObject({ av: 'ok', src: 'sirene' });
  });

  it('est déterministe', () => {
    const c = [{ src: 'osm', text: 'x', ban: ban() }];
    expect(decideAddress(fiche, c)).toEqual(decideAddress(fiche, c));
  });
});
