import { parisDay } from './photoXp';

/**
 * XP des défis : plafond par jour et jamais deux fois pour le même défi (anti-farm).
 * Envoyer un défi à soi-même en boucle, ou rejouer un défi déjà relevé, ne rapporte rien de plus.
 * Fonctions pures : l'état est lu et écrit par l'appelant (voir `payDefiXp`).
 */
export type DefiKind = 'sent' | 'done';

export const DEFI_DAILY_CAP: Record<DefiKind, number> = { sent: 3, done: 3 };
export const SOCIAL_XP_KEY = 'fooder_social_xp';
const MAX_CLAIMED = 200;

export interface SocialXpState {
  /** Jour (Paris) auquel se rapportent les compteurs. */
  day: string;
  counts: Record<DefiKind, number>;
  /** Défis déjà payés (« kind:id »), les plus récents à la fin. */
  claimed: string[];
}

export const EMPTY_SOCIAL_XP: SocialXpState = { day: '', counts: { sent: 0, done: 0 }, claimed: [] };

export interface DefiClaim {
  paid: boolean;
  reason?: 'already' | 'cap';
  state: SocialXpState;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Relit un état stocké en tolérant n'importe quelle valeur. */
export function normalizeSocialXp(raw: unknown): SocialXpState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_SOCIAL_XP;
  const r = raw as Record<string, unknown>;
  const c = typeof r.counts === 'object' && r.counts !== null ? (r.counts as Record<string, unknown>) : {};
  return {
    day: typeof r.day === 'string' ? r.day : '',
    counts: { sent: count(c.sent), done: count(c.done) },
    claimed: Array.isArray(r.claimed) ? r.claimed.filter((x): x is string => typeof x === 'string').slice(-MAX_CLAIMED) : [],
  };
}

/** Tente de payer l'XP d'un défi. Un refus pour plafond n'est pas retenu : le défi pourra payer un autre jour. */
export function claimDefiXp(state: SocialXpState, kind: DefiKind, defiId: string, now: number): DefiClaim {
  const key = `${kind}:${defiId}`;
  if (state.claimed.includes(key)) return { paid: false, reason: 'already', state };
  const today = parisDay(now);
  const counts = state.day === today ? state.counts : { sent: 0, done: 0 };
  if (counts[kind] >= DEFI_DAILY_CAP[kind]) return { paid: false, reason: 'cap', state: { ...state, day: today, counts } };
  return {
    paid: true,
    state: {
      day: today,
      counts: { ...counts, [kind]: counts[kind] + 1 },
      claimed: [...state.claimed, key].slice(-MAX_CLAIMED),
    },
  };
}
