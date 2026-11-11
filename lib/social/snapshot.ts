import { AVATARS, AVATAR_BACKGROUNDS, AvatarChoice, DEFAULT_AVATAR } from '../avatars';
import { STICKERS, StickerName } from '../stickers';
import { arr, num, obj, str, ts } from './codec';

/** Carte d'ami : instantané public du profil, partagé par lien ou QR code. */
export interface FriendSnapshot {
  v: 1;
  id: string;
  name: string;
  avatar: AvatarChoice;
  level: number;
  xp: number;
  archetype: string;
  archetypeSticker: StickerName;
  /** Cuisines likées et leur nombre, triées */
  cuisines: [string, number][];
  /** Restos likés : [id, nom, cuisine] */
  likes: [string, string, string][];
  quartiers: string[];
  visits: number;
  /** Semaine de l'instantané et visites cette semaine-là (classement hebdo) */
  week: number;
  weekVisits: number;
  streak: number;
  photos: number;
  at: number;
}

export const SNAPSHOT_LIMITS = { likes: 30, likesQr: 12, cuisines: 6, quartiers: 18, name: 20, label: 40 };

const AVATAR_IDS = new Set(AVATARS.map(a => a.id));
const BG_IDS = new Set<string>(AVATAR_BACKGROUNDS.map(b => b.id));
const STICKER_SET = new Set<string>(STICKERS);

/** Valide un instantané reçu d'un lien. Toute donnée inattendue est rejetée ou bornée. */
export function parseSnapshot(raw: unknown): FriendSnapshot | null {
  const o = obj(raw);
  if (!o || o.v !== 1) return null;
  const id = str(o.id, 40);
  const name = str(o.name, SNAPSHOT_LIMITS.name);
  if (!id || !/^[a-z0-9]+$/i.test(id) || !name) return null;

  const av = obj(o.avatar);
  const avId = str(av?.id, 20);
  const avBg = str(av?.bg, 20);
  const avatar: AvatarChoice = {
    id: avId && AVATAR_IDS.has(avId) ? avId : DEFAULT_AVATAR.id,
    bg: avBg && BG_IDS.has(avBg) ? avBg : DEFAULT_AVATAR.bg,
  };
  const sticker = str(o.archetypeSticker, 20);

  const cuisines: [string, number][] = [];
  for (const c of arr(o.cuisines, SNAPSHOT_LIMITS.cuisines)) {
    const pair = arr(c, 2);
    const label = str(pair[0], SNAPSHOT_LIMITS.label);
    const count = num(pair[1], 0, 10_000);
    if (label && count !== null) cuisines.push([label, Math.round(count)]);
  }

  const likes: [string, string, string][] = [];
  for (const l of arr(o.likes, SNAPSHOT_LIMITS.likes)) {
    const t = arr(l, 3);
    const lid = str(t[0], 40);
    const lname = str(t[1], 60);
    if (lid && lname) likes.push([lid, lname, str(t[2], SNAPSHOT_LIMITS.label) ?? '']);
  }

  const quartiers = arr(o.quartiers, SNAPSHOT_LIMITS.quartiers)
    .map(q => str(q, 30))
    .filter((q): q is string => Boolean(q));

  const int = (v: unknown, max: number) => Math.round(num(v, 0, max) ?? 0);

  return {
    v: 1,
    id,
    name,
    avatar,
    level: Math.max(1, int(o.level, 10)),
    xp: int(o.xp, 1_000_000),
    archetype: str(o.archetype, SNAPSHOT_LIMITS.label) ?? 'Foodie en devenir',
    archetypeSticker: (sticker && STICKER_SET.has(sticker) ? sticker : 'donut') as StickerName,
    cuisines,
    likes,
    quartiers,
    visits: int(o.visits, 100_000),
    week: int(o.week, 1_000_000),
    weekVisits: int(o.weekVisits, 1000),
    streak: int(o.streak, 1000),
    photos: int(o.photos, 100_000),
    at: ts(o.at),
  };
}

/** Version allégée pour le QR code (un QR trop dense ne se scanne plus). */
export function compactSnapshot(s: FriendSnapshot): FriendSnapshot {
  return {
    ...s,
    likes: s.likes.slice(0, SNAPSHOT_LIMITS.likesQr).map(([id, n, c]) => [id, n.slice(0, 24), c.slice(0, 16)]),
    cuisines: s.cuisines.slice(0, 4),
  };
}
