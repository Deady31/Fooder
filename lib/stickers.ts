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

/** Texte sans accents ni majuscules, pour comparer sans se soucier de l'écriture. */
const fold = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Rule = [RegExp, FoodSticker];

/**
 * 1. Cuisine précise → icône (ordre = priorité : le plus spécifique d'abord).
 * Faute d'icône dédiée, on prend la plus proche *honnêtement* (ex. libanais → kebab, pita et grillades) ;
 * les nouvelles icônes viendront affiner ces correspondances.
 */
const CUISINE_RULES: Rule[] = [
  [/pizz/, 'pizza'],
  [/hot.?dog/, 'hotdog'],
  [/french.?tacos|tacos|taco|mexic|tex.?mex|burrito|fajita|empanada/, 'taco'],
  [/burger|americain|diner/, 'burger'],
  [/kebab|doner|durum|shawarma|gyros|grec|turc|libanais|liban|syrien|oriental|arabe|moyen.?orient|falafel|mezze|israelien|armenien|afghan/, 'kebab'],
  [/sushi|maki|sashimi|izakaya|yakitori|japonais|japanese|japan/, 'sushi'],
  [/dumpling|dim.?sum|raviol|gyoza|chinois|chinese|cantonais|sichuan|pekin/, 'dumpling'],
  [/ramen|pho|vietnam|thai|coreen|korean|asiat|asian|wok|nouille|noodle|udon|bibimbap|laotien|cambodgien|indonesien|malaisien|singapour|tibetain|taiwan/, 'ramen'],
  [/indien|indian|curry|tandoor|nepal|pakistan|sri.?lank|bengali/, 'curry'],
  [/marocain|couscous|tajine|tagine|maghreb|tunisien|algerien|africain|african|ethiopien|senegalais|camerounais|ivoirien|congolais|malgache|creole|caribeen|caribbean|antillais|reunion/, 'curry'],
  [/pates|pasta|trattoria|osteria|spaghetti|lasagne/, 'pasta'],
  [/italien|italian|ristorante|napolitain/, 'pasta'],
  [/crepe|galette|gaufre|waffle|pancake|brunch/, 'brunch'],
  [/boulang|bakery|patiss|viennois|croissant|fournil/, 'croissant'],
  [/glace|gelato|ice.?cream|sorbet/, 'icecream'],
  [/dessert|gateau|cake|cupcake|macaron|donut|beignet/, 'cupcake'],
  [/bubble|boba/, 'boba'],
  [/salon de the|coffee|cafe|torrefact|barista|salon de th/, 'coffee'],
  [/vegetarien|vegan|vegetalien|salad|healthy|sain|bowl|poke|bio\b/, 'salad'],
  [/sandwich|panini|bagel|croque|\bsub\b|snack|tartine|wrap/, 'croque'],
  [/steak|grill|viande|boucher|barbecue|bbq|argentin|argentine|brasilien|bresilien|churrasco|brochette|poulet|chicken|rotisserie|rotiss|wings/, 'steak'],
  [/frite|friture|friterie|fast.?food|street|crousty|food.?truck|tenders|nuggets|fried/, 'fries'],
  [/tapas|espagnol|spanish|bar a vin|cave|vin\b|wine|cocktail|brasserie|\bbar\b|pub\b|biere|beer|lounge/, 'wine'],
];

/** 2. Mots du nom quand la cuisine est inconnue (« Restaurant »). Mots entiers uniquement. */
const NAME_RULES: Rule[] = [
  [/\b(pizz\w*|napoli|pizzeria)\b/, 'pizza'],
  [/\b(burger\w*|smash|five guys|quick|mcdonald\w*|kfc|bk)\b/, 'burger'],
  [/\b(taco\w*|tacos|cantina|hacienda|mexic\w*|burrito\w*)\b/, 'taco'],
  [/\b(kebab\w*|kebap|doner|durum|istanbul|anatolie|anatolia|ottoman\w*|sultan|bosphore|efes|beyrouth|liban\w*|cedre|cedres|mezze\w*|falafel\w*|damas|petra|orient\w*|byblos)\b/, 'kebab'],
  [/\b(sushi\w*|maki\w*|tokyo|osaka|kyoto|sakura|fuji|yamato|izakaya|hokkaido|nagoya|shogun|samourai|ninja|tempura)\b/, 'sushi'],
  [/\b(dragon\w*|pekin|shanghai|canton\w*|chine|chinois\w*|dim sum|wok\w*|bambou)\b/, 'dumpling'],
  [/\b(pho|hanoi|saigon|vietnam\w*|bangkok|siam|thai\w*|seoul|coree\w*|bibimbap|ramen\w*|udon|nouille\w*|bao)\b/, 'ramen'],
  [/\b(inde|indian\w*|delhi|mumbai|bombay|taj|maharaja\w*|punjab\w*|tandoor\w*|nepal\w*|himalaya\w*|everest|katmandou|namaste|curry\w*|masala|rajasthan)\b/, 'curry'],
  [/\b(maroc\w*|marrakech|tajine\w*|couscous\w*|atlas|casbah|medina|kasbah|tunis\w*|alger\w*|dakar|senegal\w*|afric\w*|abidjan)\b/, 'curry'],
  [/\b(trattoria|osteria|ristorante|ristoro|pasta\w*|spaghetti|bella|nonna|roma|milano|venezia|toscana|sicilia|sardegna|dolce vita)\b/, 'pasta'],
  [/\b(creperie\w*|crepe\w*|galette\w*|breizh|bretagne|bretonne?|gaufre\w*|brunch|pancake\w*)\b/, 'brunch'],
  [/\b(boulangerie\w*|boulanger\w*|fournil|patisserie\w*|viennois\w*|croissant\w*|le pain)\b/, 'croissant'],
  [/\b(glac\w*|gelato|sorbet\w*|ice cream)\b/, 'icecream'],
  [/\b(cafe\w*|coffee|torrefact\w*|barista|tea room|salon de the)\b/, 'coffee'],
  [/\b(bubble|boba)\b/, 'boba'],
  [/\b(vegan\w*|veggie|vegetarien\w*|salad\w*|healthy|bowl\w*|poke\w*|bio)\b/, 'salad'],
  [/\b(sandwich\w*|panini\w*|bagel\w*|croque\w*|snack\w*|tartine\w*|wrap\w*|subway)\b/, 'croque'],
  [/\b(poulet\w*|chicken|rotisserie\w*|wings|grill\w*|steak\w*|boucherie\w*|bbq|barbecue|churrasco|asado|gaucho)\b/, 'steak'],
  [/\b(tapas|vino|cave|vins|wine\w*|cocktail\w*|pub|bar|biere\w*|brewery|brasserie)\b/, 'wine'],
  [/\b(frite\w*|friterie\w*|fast food|food truck|crousty|tenders)\b/, 'fries'],
];

/** Icône précise pour ce restaurant, ou null si on n'a rien de fiable (à ne jamais remplacer par un tirage au hasard). */
/** Un nom sans ambiguïté l'emporte sur une cuisine générique (« Italien » + « Pizzeria Roma » = pizza). */
const STRONG_NAME: Rule[] = [
  [/\b(pizz\w*)\b/, 'pizza'],
  [/\b(burger\w*)\b/, 'burger'],
  [/\b(kebab\w*|doner|durum)\b/, 'kebab'],
  [/\b(sushi\w*|maki\w*)\b/, 'sushi'],
  [/\b(creperie\w*)\b/, 'brunch'],
  [/\b(tacos?|french tacos)\b/, 'taco'],
];

export function matchSticker(cuisine: string, name = ''): FoodSticker | null {
  const c = fold(cuisine);
  const n = fold(name);
  const strong = STRONG_NAME.find(([re]) => re.test(n));
  if (strong) return strong[1];
  const byCuisine = CUISINE_RULES.find(([re]) => re.test(c));
  if (byCuisine) return byCuisine[1];
  const byName = NAME_RULES.find(([re]) => re.test(n));
  return byName ? byName[1] : null;
}

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

export function stickerFor(cuisine: string, _id: string, name = ''): FoodSticker {
  // Cuisine inconnue ou générique (« Français », « Restaurant ») : assiette neutre, jamais une icône au hasard.
  return matchSticker(cuisine, name) ?? 'plate';
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
