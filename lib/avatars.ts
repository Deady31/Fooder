export interface AvatarDef {
  id: string;
  label: string;
  /** Niveau minimum pour le débloquer */
  level: number;
  /** Réservé Premium */
  premium?: boolean;
}

export const AVATARS: AvatarDef[] = [
  { id: 'burger', label: 'Burgy', level: 1 },
  { id: 'boba', label: 'Bobi', level: 1 },
  { id: 'donut', label: 'Dodo', level: 1 },
  { id: 'pizza', label: 'Pizzo', level: 1 },
  { id: 'ramen', label: 'Rameno', level: 3 },
  { id: 'taco', label: 'Tacoo', level: 3 },
  { id: 'sushi', label: 'Sushi', level: 3 },
  { id: 'croissant', label: 'Crouki', level: 5 },
  { id: 'icecream', label: 'Glaçon', level: 5 },
  { id: 'cupcake', label: 'Cupi', level: 10 },
  { id: 'hotdog', label: 'Hotty', level: 10, premium: true },
  { id: 'salad', label: 'Saladou', level: 1, premium: true },
];

export const AVATAR_BACKGROUNDS = [
  { id: 'bubblegum', label: 'Bubblegum', color: '#FF7EC8' },
  { id: 'lemon', label: 'Citron', color: '#FFD83D' },
  { id: 'mint', label: 'Menthe', color: '#3DDC97' },
  { id: 'violet', label: 'Violet', color: '#B79BFF' },
  { id: 'orange', label: 'Orange', color: '#FF8A1F' },
  { id: 'sky', label: 'Ciel', color: '#7FD4FF' },
  { id: 'cream', label: 'Crème', color: '#FFF6E5' },
] as const;

export interface AvatarChoice {
  id: string;
  bg: string;
}

export const DEFAULT_AVATAR: AvatarChoice = { id: 'burger', bg: 'bubblegum' };

export const avatarSrc = (id: string): string => `/avatars/${id}.webp`;

export function bgColor(bgId: string): string {
  return AVATAR_BACKGROUNDS.find(b => b.id === bgId)?.color ?? AVATAR_BACKGROUNDS[0].color;
}

export function isUnlocked(a: AvatarDef, level: number, isPremium: boolean): boolean {
  return level >= a.level && (!a.premium || isPremium);
}

export function lockReason(a: AvatarDef, level: number, isPremium: boolean): string | null {
  if (a.premium && !isPremium) return 'Premium';
  if (level < a.level) return `Niv. ${a.level}`;
  return null;
}
