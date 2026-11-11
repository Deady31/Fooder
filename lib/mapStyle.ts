import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';

const PLUM = '#2B0F3A';
const CREAM = '#FFF6E5';
const MINT = '#BFEFD6';
const WATER = '#CFC2FF';
const LEMON = '#FFD83D';

const LABEL: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

const roadWidth = (base: number): ExpressionSpecification => [
  'interpolate', ['exponential', 1.5], ['zoom'],
  10, base * 0.4,
  14, base,
  18, base * 4,
];

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'fooder',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: MAP_ATTRIBUTION,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': CREAM } },
    {
      id: 'landcover-green', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'wood', 'farmland'],
      paint: { 'fill-color': MINT, 'fill-opacity': 0.55 },
    },
    {
      id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
      paint: { 'fill-color': MINT, 'fill-opacity': 0.9 },
    },
    {
      id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': WATER },
    },
    {
      id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      paint: { 'line-color': WATER, 'line-width': roadWidth(1.5) },
    },
    {
      id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14.5,
      paint: { 'fill-color': '#F6E3C3', 'fill-outline-color': 'rgba(43,15,58,0.25)' },
    },
    {
      id: 'road-minor-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'minor', 'tertiary', 'secondary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(43,15,58,0.78)', 'line-width': roadWidth(2.5) },
    },
    {
      id: 'road-major-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'trunk', 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': PLUM, 'line-width': roadWidth(4.2) },
    },
    {
      id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'minor', 'tertiary', 'secondary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': roadWidth(1.5) },
    },
    {
      id: 'road-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'trunk', 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': LEMON, 'line-width': roadWidth(2.6) },
    },
    {
      id: 'road-service-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 15.5,
      filter: ['==', 'class', 'service'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(43,15,58,0.6)', 'line-width': roadWidth(2) },
    },
    {
      id: 'road-service', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 15.5,
      filter: ['==', 'class', 'service'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': roadWidth(1.1) },
    },
    {
      id: 'road-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': LABEL,
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
      },
      paint: { 'text-color': 'rgba(43,15,58,0.75)', 'text-halo-color': CREAM, 'text-halo-width': 2 },
    },
    {
      id: 'water-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
      layout: { 'text-field': LABEL, 'text-font': ['Noto Sans Bold'], 'text-size': 12 },
      paint: { 'text-color': '#6C2BFF', 'text-halo-color': CREAM, 'text-halo-width': 1.5 },
    },
    {
      id: 'place-suburb', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter'],
      layout: {
        'text-field': LABEL,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 15],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': 'rgba(43,15,58,0.55)', 'text-halo-color': CREAM, 'text-halo-width': 2 },
    },
    {
      id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town'],
      layout: {
        'text-field': LABEL,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 14, 20],
      },
      paint: { 'text-color': PLUM, 'text-halo-color': CREAM, 'text-halo-width': 2.5 },
    },
  ],
};
