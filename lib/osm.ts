import type { Restaurant } from '../data/mockRestaurants';
import { parseOsmHours } from './osmHours';

/** Enregistrement compact produit par scripts/import-osm.mjs */
export interface OsmRecord {
  id: string;
  n: string; // nom
  k: string; // amenity
  c: string; // cuisine
  la: number;
  ln: number;
  a: string; // adresse
  h: string; // opening_hours
  w: string; // site web
  d: 0 | 1; // végétarien
}

const CUISINE_FR: Record<string, string> = {
  pizza: 'Pizzeria', burger: 'Burger', kebab: 'Kebab', sushi: 'Japonais', japanese: 'Japonais',
  chinese: 'Chinois', thai: 'Thaï', vietnamese: 'Vietnamien', indian: 'Indien', italian: 'Italien',
  french: 'Français', regional: 'Terroir', mexican: 'Mexicain', lebanese: 'Libanais', greek: 'Grec',
  turkish: 'Turc', sandwich: 'Sandwich', coffee_shop: 'Café', crepe: 'Crêperie', vegetarian: 'Végétarien',
  vegan: 'Vegan', seafood: 'Poissons', steak_house: 'Grill', asian: 'Asiatique', korean: 'Coréen',
  moroccan: 'Marocain', african: 'Africain', tapas: 'Tapas', bakery: 'Boulangerie', ice_cream: 'Glacier',
};

const AMENITY_FR: Record<string, string> = {
  restaurant: 'Restaurant', fast_food: 'Street & Fast', cafe: 'Café', bar: 'Bar', pub: 'Bar', ice_cream: 'Glacier',
};

export function cuisineLabel(rec: Pick<OsmRecord, 'c' | 'k' | 'd'>): string {
  const first = rec.c.split(/[;,]/)[0]?.trim().toLowerCase();
  if (first && CUISINE_FR[first]) return CUISINE_FR[first];
  if (rec.d) return 'Végétarien';
  return AMENITY_FR[rec.k] ?? 'Restaurant';
}

const R = 6371000;
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Transforme un enregistrement OSM en carte Fooder. Pas de note ni de photo inventées. */
export function osmToRestaurant(rec: OsmRecord, origin?: { lat: number; lng: number }): Restaurant {
  const dist = origin ? haversine(origin.lat, origin.lng, rec.la, rec.ln) : undefined;
  const cuisine = cuisineLabel(rec);
  return {
    id: rec.id,
    name: rec.n,
    rating: 0,
    price: 0,
    distance: dist !== undefined ? formatMeters(dist) : 'Toulouse',
    distanceMeters: dist !== undefined ? Math.round(dist) : undefined,
    cuisine,
    image: '',
    address: rec.a || 'Toulouse',
    lat: rec.la,
    lng: rec.ln,
    description: '',
    website: rec.w || undefined,
    hours: parseOsmHours(rec.h),
    dataSource: 'osm',
  };
}
