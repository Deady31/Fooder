import { haversine } from './geo';

interface Quartier {
  name: string;
  lat: number;
  lng: number;
}

// Centres approximatifs des quartiers toulousains (rayon d'attribution : 1,3 km).
const QUARTIERS: Quartier[] = [
  { name: 'Capitole', lat: 43.6045, lng: 1.4442 },
  { name: 'Carmes', lat: 43.5995, lng: 1.4455 },
  { name: 'Saint-Étienne', lat: 43.6, lng: 1.451 },
  { name: 'Saint-Cyprien', lat: 43.599, lng: 1.433 },
  { name: 'Jean-Jaurès', lat: 43.6064, lng: 1.449 },
  { name: 'Wilson', lat: 43.6068, lng: 1.4535 },
  { name: 'Compans', lat: 43.614, lng: 1.435 },
  { name: 'Arnaud Bernard', lat: 43.609, lng: 1.439 },
  { name: 'Minimes', lat: 43.623, lng: 1.44 },
  { name: 'Saint-Aubin', lat: 43.596, lng: 1.459 },
  { name: 'Saint-Michel', lat: 43.59, lng: 1.448 },
  { name: 'Busca', lat: 43.587, lng: 1.457 },
  { name: "Patte d'Oie", lat: 43.588, lng: 1.414 },
  { name: 'Purpan', lat: 43.606, lng: 1.398 },
  { name: 'Bonnefoy', lat: 43.619, lng: 1.462 },
  { name: 'Rangueil', lat: 43.561, lng: 1.465 },
  { name: 'Empalot', lat: 43.578, lng: 1.441 },
  { name: 'Les Chalets', lat: 43.611, lng: 1.45 },
];

/** Quartier le plus proche, ou null si le point est trop loin d'un centre connu. */
export function quartierFor(lat: number, lng: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const q of QUARTIERS) {
    const d = haversine(lat, lng, q.lat, q.lng);
    if (!best || d < best.d) best = { name: q.name, d };
  }
  return best && best.d <= 1300 ? best.name : null;
}
