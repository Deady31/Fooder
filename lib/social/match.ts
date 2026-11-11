import { FriendSnapshot } from './snapshot';

export interface FoodMatch {
  /** 0 à 100, null si l'un des deux n'a pas encore assez swipé */
  score: number | null;
  verdict: string;
  common: { id: string; name: string; cuisine: string }[];
  sharedCuisines: string[];
  /** Cuisine que l'ami adore et que tu n'as jamais likée */
  toDiscover: string | null;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  a.forEach((v, k) => {
    na += v * v;
    dot += v * (b.get(k) ?? 0);
  });
  b.forEach(v => {
    nb += v * v;
  });
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function verdictFor(score: number): string {
  if (score >= 85) return 'Âmes sœurs culinaires';
  if (score >= 70) return 'Même longueur d’onde';
  if (score >= 50) return 'Bonne entente à table';
  if (score >= 30) return 'Goûts complémentaires';
  return 'Opposés qui s’attirent';
}

/**
 * Compatibilité gustative : 60 % profil de cuisines, 25 % restos likés en commun, 15 % quartiers partagés.
 */
export function foodMatch(me: FriendSnapshot, other: FriendSnapshot): FoodMatch {
  const ca = new Map(me.cuisines.map(([c, n]) => [norm(c), n]));
  const cb = new Map(other.cuisines.map(([c, n]) => [norm(c), n]));
  const myIds = new Set(me.likes.map(l => l[0]));
  const common = other.likes.filter(l => myIds.has(l[0])).map(([id, name, cuisine]) => ({ id, name, cuisine }));
  const sharedCuisines = other.cuisines.filter(([c]) => ca.has(norm(c))).map(([c]) => c);
  const toDiscover = other.cuisines.find(([c]) => !ca.has(norm(c)))?.[0] ?? null;

  if (ca.size === 0 || cb.size === 0) {
    return { score: null, verdict: 'Pas encore assez de swipes', common, sharedCuisines, toDiscover };
  }

  const qa = new Set(me.quartiers);
  const qUnion = new Set([...me.quartiers, ...other.quartiers]);
  const qInter = other.quartiers.filter(q => qa.has(q)).length;
  const quartierScore = qUnion.size > 0 ? qInter / qUnion.size : 0;

  const commonGoal = Math.max(1, Math.min(3, me.likes.length, other.likes.length));
  const taste = 0.6 * cosine(ca, cb) + 0.25 * Math.min(1, common.length / commonGoal);
  // Sans quartier visité d'un côté comme de l'autre, on ne pénalise pas : le poids est redistribué.
  const raw = qUnion.size > 0 ? taste + 0.15 * quartierScore : taste / 0.85;
  const score = Math.round(Math.min(1, raw) * 100);
  return { score, verdict: verdictFor(score), common, sharedCuisines, toDiscover };
}
