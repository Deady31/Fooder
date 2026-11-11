import { Restaurant } from '../data/mockRestaurants';
import { FeedPost } from './feed';
import { StickerName } from './stickers';
import { Visit, visitedQuartiers } from './visits';

// ── Le vendredi Fooder : 3 coups de cœur à tester ce week-end ────────────────

const SATURDAY = 5; // index WeekHours (0 = lundi)
const SAT_EVENING = 20 * 60;

/** Fenêtre du rituel : du jeudi 18 h au dimanche soir. */
export function isWeekendWindow(now: Date = new Date()): boolean {
  const d = now.getDay();
  return (d === 4 && now.getHours() >= 18) || d === 5 || d === 6 || d === 0;
}

function openSaturdayEvening(r: Restaurant): boolean | null {
  const day = r.hours?.[SATURDAY];
  if (!day) return null;
  return day.some(([a, b]) => a <= SAT_EVENING && b > SAT_EVENING);
}

export function weekendPicks(likes: Restaurant[], visits: Visit[], count = 3): Restaurant[] {
  const visited = new Set(visits.map(v => v.restId));
  const rank = (r: Restaurant) => {
    const open = openSaturdayEvening(r);
    return open === true ? 0 : open === null ? 1 : 2;
  };
  return likes
    .filter(r => !visited.has(r.id))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || b.i - a.i) // ouverts samedi soir d'abord, puis les likes récents
    .slice(0, count)
    .map(x => x.r);
}

// ── Défis du mois ─────────────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  title: string;
  desc: string;
  sticker: StickerName;
  progress: number;
  goal: number;
}

const sameMonth = (ts: number, now: Date) => {
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export function monthlyChallenges(visits: Visit[], posts: FeedPost[], now: Date = new Date()): Challenge[] {
  const month = visits.filter(v => sameMonth(v.at, now));
  const cuisines = new Set(month.map(v => v.cuisine.toLowerCase()));
  const quartiers = visitedQuartiers(month);
  const photos = posts.filter(p => p.mine && p.photo && sameMonth(p.createdAt, now)).length;
  const monthName = now.toLocaleDateString('fr-FR', { month: 'long' });
  return [
    { id: 'world', title: 'Tour du monde', desc: `5 cuisines différentes en ${monthName}`, sticker: 'curry', progress: cuisines.size, goal: 5 },
    { id: 'quartiers', title: 'Toulouse à la fourchette', desc: `3 quartiers différents en ${monthName}`, sticker: 'croissant', progress: quartiers.size, goal: 3 },
    { id: 'photos', title: 'Œil de lynx', desc: `3 vraies photos de plats en ${monthName}`, sticker: 'sushi', progress: photos, goal: 3 },
  ].map(c => ({ ...c, sticker: c.sticker as StickerName, progress: Math.min(c.progress, c.goal) }));
}

// ── Titres de contributeur ───────────────────────────────────────────────────

export interface ContributorTitle {
  id: string;
  label: string;
  desc: string;
  unlocked: boolean;
}

export function contributorTitles(visits: Visit[], photos: number): ContributorTitle[] {
  const q = visitedQuartiers(visits).size;
  return [
    { id: 'eclaireur', label: 'Éclaireur', desc: '1re vraie photo publiée', unlocked: photos >= 1 },
    { id: 'critique', label: 'Critique', desc: '10 visites confirmées', unlocked: visits.length >= 10 },
    { id: 'reporter', label: 'Reporter', desc: '5 vraies photos publiées', unlocked: photos >= 5 },
    { id: 'cartographe', label: 'Cartographe', desc: '5 quartiers explorés', unlocked: q >= 5 },
  ];
}

export function bestTitle(titles: ContributorTitle[]): string {
  const order = ['cartographe', 'reporter', 'critique', 'eclaireur'];
  return order.map(id => titles.find(t => t.id === id && t.unlocked)?.label).find(Boolean) ?? 'Nouveau foodie';
}

// ── Avantages débloqués par niveau (exemples, en attente de vrais partenaires) ─

export interface Perk {
  level: number;
  label: string;
  sticker: StickerName;
}

export const PERKS: Perk[] = [
  { level: 2, label: 'Un café offert chez un partenaire', sticker: 'coffee' },
  { level: 4, label: 'Dessert offert pour 2 couverts', sticker: 'cupcake' },
  { level: 6, label: '-10 % sur l’addition, un soir de semaine', sticker: 'b_coin' },
  { level: 8, label: 'Table réservée aux foodies du mois', sticker: 'plate' },
  { level: 10, label: 'Soirée dégustation chez un chef partenaire', sticker: 'wine' },
];
