#!/usr/bin/env node
/**
 * Importe les contours des « grands quartiers » de Toulouse (Mairie de Toulouse, Licence Ouverte v2.0 Etalab)
 * depuis data.toulouse-metropole.fr et écrit data/quartiers-toulouse.json (compact, versionné, ~90 Ko).
 *
 * Jeu de données : « Recensement population 2011 - Grands quartiers - Logement » (toulouse_gq_logement_rp2011), 60 polygones.
 * On n'utilise QUE le contour et le nom ; les statistiques du recensement sont ignorées.
 *
 * Usage : node scripts/import-quartiers.mjs [--offline]   (--offline relit data/cache/quartiers-source.geojson)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = 'toulouse_gq_logement_rp2011';
const URL_ = `https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets/${DATASET}/exports/geojson`;
const CACHE = path.join(ROOT, 'data', 'cache', 'quartiers-source.geojson');
const OUT = path.join(ROOT, 'data', 'quartiers-toulouse.json');
const UA = 'FooderDataCheck/1.0 (+https://github.com/Deady31/Fooder)';

/** Noms de la source (majuscules, sans accents) vers l'écriture française. Le script s'arrête si un nom n'y figure pas. */
const DISPLAY = {
  'AMIDONNIERS': 'Amidonniers', 'ARENES': 'Arènes', 'ARNAUD BERNARD': 'Arnaud Bernard', 'BAGATELLE': 'Bagatelle',
  'BARRIERE-DE-PARIS': 'Barrière-de-Paris', 'BASSO-CAMBO': 'Basso-Cambo', 'BELLEFONTAINE': 'Bellefontaine', 'BONNEFOY': 'Bonnefoy',
  'CAPITOLE': 'Capitole', 'CARMES': 'Carmes', 'CASSELARDIT': 'Casselardit', "CHATEAU-DE-L'HERS": "Château-de-l'Hers",
  'COMPANS': 'Compans', 'COTE PAVEE': 'Côte Pavée', 'CROIX-DAURADE': 'Croix-Daurade', 'CROIX-DE-PIERRE': 'Croix-de-Pierre',
  'EMPALOT': 'Empalot', 'FAOURETTE': 'Faourette', 'FER-A-CHEVAL': 'Fer-à-Cheval', 'FONTAINE-LESTANG': 'Fontaine-Lestang',
  'GINESTOUS': 'Ginestous', 'GRAMONT': 'Gramont', 'GUILHEMERY': 'Guilhémery', 'JULES JULIEN': 'Jules Julien',
  'JUNCASSE - ARGOULETS': 'Juncasse - Argoulets', 'LA CEPIERE': 'La Cépière', 'LA FOURGUETTE': 'La Fourguette', 'LA TERRASSE': 'La Terrasse',
  'LALANDE': 'Lalande', 'LARDENNE': 'Lardenne', 'LE BUSCA': 'Le Busca', 'LES CHALETS': 'Les Chalets', 'LES IZARDS': 'Les Izards',
  'LES PRADETTES': 'Les Pradettes', 'MARENGO - JOLIMONT': 'Marengo - Jolimont', 'MATABIAU': 'Matabiau', 'MINIMES': 'Minimes',
  'MIRAIL-UNIVERSITE': 'Mirail-Université', 'MONTAUDRAN - LESPINET': 'Montaudran - Lespinet', 'PAPUS': 'Papus', "PATTE D'OIE": "Patte d'Oie",
  'PONT-DES-DEMOISELLES': 'Pont-des-Demoiselles', 'POUVOURVILLE': 'Pouvourville', 'PURPAN': 'Purpan', 'RAMIER': 'Ramier',
  'RANGUEIL - CHR - FACULTES': 'Rangueil - CHR - Facultés', 'REYNERIE': 'Reynerie', 'ROSERAIE': 'Roseraie',
  'SAINT-AGNE': 'Saint-Agne', 'SAINT-AUBIN - DUPUY': 'Saint-Aubin - Dupuy', 'SAINT-CYPRIEN': 'Saint-Cyprien', 'SAINT-ETIENNE': 'Saint-Étienne',
  'SAINT-GEORGES': 'Saint-Georges', 'SAINT-MARTIN-DU-TOUCH': 'Saint-Martin-du-Touch', 'SAINT-MICHEL': 'Saint-Michel', 'SAINT-SIMON': 'Saint-Simon',
  'SAUZELONG - RANGUEIL': 'Sauzelong - Rangueil', 'SEPT DENIERS': 'Sept Deniers', 'SOUPETARD': 'Soupetard', "ZONES D'ACTIVITES SUD": "Zones d'activités Sud",
};

const round = n => Math.round(n * 1e5) / 1e5; // 5 décimales : environ 1 m

let geojson;
if (process.argv.includes('--offline')) geojson = JSON.parse(await fs.readFile(CACHE, 'utf8'));
else {
  const res = await fetch(URL_, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const text = await res.text();
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, text);
  geojson = JSON.parse(text);
}

const quartiers = [];
for (const f of geojson.features) {
  const raw = f.properties.libelle_du_grand_quartier;
  const name = DISPLAY[raw];
  if (!name) throw new Error(`nom absent de la table d'affichage : ${raw}`);
  if (f.geometry?.type !== 'Polygon') throw new Error(`géométrie inattendue pour ${raw} : ${f.geometry?.type}`);
  // GeoJSON : [longitude, latitude] ; on stocke [latitude, longitude]. Premier anneau : contour ; les suivants : trous.
  const rings = f.geometry.coordinates.map(ring => ring.map(([lng, lat]) => [round(lat), round(lng)]));
  const pts = rings[0];
  const lats = pts.map(p => p[0]);
  const lngs = pts.map(p => p[1]);
  quartiers.push({ name, bbox: [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)], rings });
}
quartiers.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
if (new Set(quartiers.map(q => q.name)).size !== quartiers.length) throw new Error('noms en double');

const out = {
  source: 'Mairie de Toulouse, « Recensement population 2011 - Grands quartiers - Logement », data.toulouse-metropole.fr',
  dataset: DATASET,
  licence: 'Licence Ouverte v2.0 (Etalab)',
  licenceUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
  retrievedAt: new Date().toISOString().slice(0, 10),
  quartiers,
};
await fs.writeFile(OUT, JSON.stringify(out) + '\n');
const points = quartiers.reduce((n, q) => n + q.rings.reduce((m, r) => m + r.length, 0), 0);
console.log(`${quartiers.length} quartiers, ${points} points, ${((await fs.stat(OUT)).size / 1024).toFixed(0)} Ko → data/quartiers-toulouse.json`);
