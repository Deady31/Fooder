export const FOOD_STICKERS = [
  'burger', 'pizza', 'ramen', 'boba', 'taco', 'sushi', 'croissant', 'fries', 'donut',
  'icecream', 'salad', 'hotdog', 'dumpling', 'cupcake', 'steak', 'coffee', 'curry', 'kebab', 'croque',
  'plate', 'wine', 'brunch', 'pasta',
] as const;

export const BADGE_STICKERS = [
  'b_trophy', 'b_flame', 'b_heart', 'b_star', 'b_bolt', 'b_coin', 'b_dice', 'b_medal',
] as const;

export const UI_STICKERS = ['sparkle'] as const;

export const STICKERS = [...FOOD_STICKERS, ...BADGE_STICKERS, ...UI_STICKERS] as const;

export type FoodSticker = (typeof FOOD_STICKERS)[number];
export type BadgeSticker = (typeof BADGE_STICKERS)[number];
export type UiSticker = (typeof UI_STICKERS)[number];
export type StickerName = FoodSticker | BadgeSticker | UiSticker;

const FOOD_RULES: [RegExp, FoodSticker][] = [
  [/pizz/i, 'pizza'],
  [/trattoria|pasta|p[âa]tes|spaghetti/i, 'pasta'],
  [/burger/i, 'burger'],
  [/kebab|kabab|d[ôo]ner|grec|turc/i, 'kebab'],
  [/sushi|japon|japan|ramen|asia|chin|thai|vietn/i, 'ramen'],
  [/n[ée]pal|indi|curry|tandoor/i, 'curry'],
  [/mexic|tex|taco/i, 'taco'],
  [/boulang|bakery|p[âa]tiss|viennois/i, 'croissant'],
  [/brunch|pancake/i, 'brunch'],
  [/caf[eé]|coffee|salon de th/i, 'coffee'],
  [/veg|v[ée]g[ée]|salad|healthy|sain/i, 'salad'],
  [/vin|wine|cave|bar [àa]/i, 'wine'],
  [/gastro|bistro|[ée]toil|fine|table/i, 'plate'],
  [/boba|bubble/i, 'boba'],
  [/glace|ice/i, 'icecream'],
  [/dessert|g[âa]teau|cake/i, 'cupcake'],
  [/grill|steak|viande|boucher/i, 'steak'],
  [/street|fast|frites/i, 'fries'],
];

const BADGE_BY_ACHIEVEMENT: Record<string, BadgeSticker> = {
  first_swipe: 'b_bolt',
  first_like: 'b_heart',
  streak_3: 'b_flame',
  streak_7: 'b_flame',
  streak_30: 'b_trophy',
  likes_10: 'b_heart',
  likes_50: 'b_medal',
  level_5: 'b_star',
  level_10: 'b_star',
  cheap_hunter: 'b_coin',
  gasto_hunter: 'b_medal',
  swipes_100: 'b_bolt',
  premium: 'b_star',
  casino_win: 'b_dice',
  friend_1: 'b_heart',
  friends_5: 'b_medal',
  group_1: 'b_dice',
  visit_1: 'b_star',
  visits_10: 'b_trophy',
  week_streak_4: 'b_flame',
  quartiers_5: 'b_medal',
  photo_1: 'b_bolt',
  photos_5: 'b_trophy',
  defi_1: 'b_coin',
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function stickerFor(cuisine: string, id: string, name = ''): FoodSticker {
  const text = `${name} ${cuisine}`;
  const hit = FOOD_RULES.find(([re]) => re.test(text));
  if (hit) return hit[1];
  return FOOD_STICKERS[hash(id) % FOOD_STICKERS.length];
}

export function badgeFor(achievementId: string): BadgeSticker {
  return BADGE_BY_ACHIEVEMENT[achievementId] ?? 'b_star';
}

export function stickerSrc(name: StickerName): string {
  return `/stickers/${name}.webp`;
}

export function randomStickers(count: number, seed: string): FoodSticker[] {
  const start = hash(seed);
  return Array.from({ length: count }, (_, i) => FOOD_STICKERS[(start + i * 7) % FOOD_STICKERS.length]);
}
