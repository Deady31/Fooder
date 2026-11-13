export const FOOD_STICKERS = [
  'burger', 'pizza', 'ramen', 'boba', 'taco', 'sushi', 'croissant', 'fries', 'donut',
  'icecream', 'salad', 'hotdog', 'dumpling', 'cupcake', 'steak', 'coffee', 'curry', 'kebab', 'croque',
  'plate', 'wine', 'brunch', 'pasta',
  // Lot 1 (recette « pizza »)
  'french', 'bistro', 'cassoulet', 'mezze', 'thai', 'african', 'tagine', 'couscous', 'korean',
  'crepe', 'seafood', 'tapas', 'sandwich', 'vietnam', 'chinese',
  // Lot 2 (même recette)
  'falafel', 'poke', 'gyros', 'paella', 'burrito', 'cocktail', 'winebar', 'chicken', 'yakitori', 'naan',
  'momo', 'beer', 'steakhouse', 'waffle', 'fondue',
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
const fold = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Rule = [RegExp, FoodSticker];

/**
 * 1. Cuisine précise → icône (ordre = priorité : le plus spécifique d'abord).
 * Faute d'icône dédiée, on prend la plus proche *honnêtement* (ex. libanais → mezze).
 */
const CUISINE_RULES: Rule[] = [
  [/pizz|panuozzo/, 'pizza'],
  [/hot.?dog/, 'hotdog'],
  [/french.?tacos|tacos|taco|mexic|empanada/, 'taco'],
  [/tex.?mex|burrito|fajita/, 'burrito'],
  [/burger|americain|diner/, 'burger'],
  [/gyros|grec|greek/, 'gyros'],
  [/kebab|doner|durum|shawarma|turc|turkish/, 'kebab'],
  [/falafel/, 'falafel'],
  [/libanais|liban|syrien|syrian|oriental|arab|moyen.?orient|middle.?eastern|mezze|israelien|armenien|armenian|afghan|persan|persian|iranien|georgien|mediterran|palestin|kosher/, 'mezze'],
  [/poke|hawai/, 'poke'],
  [/izakaya|yakitori/, 'yakitori'],
  [/sushi|maki|sashimi|japonais|japanese|japan/, 'sushi'],
  [/dumpling|dim.?sum|raviol|gyoza/, 'dumpling'],
  [/chinois|chinese|cantonais|sichuan|pekin/, 'chinese'],
  [/pho\b|vietnam/, 'vietnam'],
  [/thai/, 'thai'],
  [/coreen|korean|bibimbap/, 'korean'],
  [/momo|tibet/, 'momo'],
  [/ramen|asiat|asian|wok|nouille|noodle|udon|laotien|cambodg|cambodian|khmer|indonesien|malaisien|singapour|singaporean|taiwan/, 'ramen'],
  [/tandoor|naan/, 'naan'],
  [/indien|indian|curry|nepal|pakistan|sri.?lank|bengali/, 'curry'],
  [/couscous/, 'couscous'],
  [/marocain|moroccan|tajine|tagine|maghreb|tunisien|tunisian|algerien|algerian|kabyle/, 'tagine'],
  [/africain|african|ethiopien|senegal|camerounais|ivoirien|congolais|malgache|creole|caribeen|caribbean|antillais|reunion|dominican/, 'african'],
  [/paella/, 'paella'],
  [/pates|pasta|trattoria|osteria|spaghetti|lasagne/, 'pasta'],
  [/italien|italian|ristorante|napolitain|focaccia/, 'pasta'],
  [/crepe|galette|breton/, 'crepe'],
  [/gaufre|waffle/, 'waffle'],
  [/pancake|brunch|breakfast|french toast/, 'brunch'],
  [/boulang|bakery|patiss|viennois|croissant|fournil/, 'croissant'],
  [/glace|gelato|ice.?cream|sorbet/, 'icecream'],
  [/dessert|gateau|cake|cupcake|macaron|donut|beignet/, 'cupcake'],
  [/bubble|boba/, 'boba'],
  [/salon de the|coffee|cafe|torrefact|barista|salon de th|\btea\b/, 'coffee'],
  [/vegetarien|vegan|vegetalien|salad|healthy|sain|\bbowls?\b|bio\b|paleo|juice|jus de/, 'salad'],
  [/croque/, 'croque'],
  [/sandwich|panini|bagel|\bsub\b|snack|tartine|wrap/, 'sandwich'],
  [/poisson|fruits? de mer|seafood|fish|huitre|moule/, 'seafood'],
  [/poulet|chicken|rotisserie|rotiss|wings|tenders|nuggets|fried chicken/, 'chicken'],
  [/argentin|bresilien|brasilien|churrasco|barbecue|bbq|steakhouse|\bmeat\b|asado/, 'steakhouse'],
  [/steak|grill|viande|boucher|brochette/, 'steak'],
  [/frite|friture|friterie|fast.?food|street|crousty|food.?truck|fries|poutine|canadian|fried/, 'fries'],
  [/tapas|espagnol|spanish|portugais|portuguese|peruvien|latin|chilean|venezuel|colombi|south.?american/, 'tapas'],
  [/brasserie|bistro|belgian|belge|german|allemand|comfort|russian|ukrain|bulgar|norweg|polish|polonais/, 'bistro'],
  [/fondue|raclette|savoyard/, 'fondue'],
  [/terroir|regional|sud.?ouest|cassoulet|auvergnat|lyonnais|traditional|basque|local\b/, 'cassoulet'],
  [/bar a vin|\bcave\b|vin\b|wine/, 'winebar'],
  [/biere|beer|pub\b|brasseur/, 'beer'],
  [/cocktail|\bbar\b|lounge/, 'cocktail'],
  [/^francais|^french|fine dining|gastronom|haute|european|europeen/, 'french'],
];

/** 2. Mots du nom quand la cuisine est inconnue (« Restaurant »). Mots entiers uniquement. */
const NAME_RULES: Rule[] = [
  [/\b(pizz\w*|napoli|pizzeria|panuozzo)\b/, 'pizza'],
  [/\b(burger\w*|five guys|quick|mcdonald\w*|bk)\b/, 'burger'],
  [/\b(burrito\w*|tex ?mex|chipotle|fajita\w*)\b/, 'burrito'],
  [/\b(taco\w*|tacos|cantina|hacienda|mexic\w*)\b/, 'taco'],
  [/\b(grec|greek|gyros|santorin\w*|samothras|athenes|acropol\w*|mykonos)\b/, 'gyros'],
  [/\b(kebab\w*|kebap|doner|durum|istanbul|anatolie|anatolia|ottoman\w*|sultan|bosphore|efes)\b/, 'kebab'],
  [/\b(falafel\w*)\b/, 'falafel'],
  [/\b(beyrouth|liban\w*|cedre|cedres|mezze\w*|damas|petra|orient\w*|byblos|persan\w*|perse|sabra)\b/, 'mezze'],
  [/\b(poke\w*|poko\w*|pokaw\w*|pokai)\b/, 'poke'],
  [/\b(yakitori\w*|izakaya\w*)\b/, 'yakitori'],
  [/\b(sushi\w*|maki\w*|tokyo|osaka|kyoto|sakura|fuji|yamato|hokkaido|nagoya|shogun|samourai|ninja|tempura|okinawa)\b/, 'sushi'],
  [/\b(dragon\w*|pekin|shanghai|canton\w*|chine|chinois\w*|wok\w*|bambou)\b/, 'chinese'],
  [/\b(dim sum)\b/, 'dumpling'],
  [/\b(pho|hanoi|saigon|vietnam\w*|bo[ -]?bun)\b/, 'vietnam'],
  [/\b(bangkok|siam|thai\w*)\b/, 'thai'],
  [/\b(seoul|coree\w*|bibimbap|korea\w*)\b/, 'korean'],
  [/\b(ramen\w*|udon|nouille\w*|bao)\b/, 'ramen'],
  [/\b(momo\w*|tibet\w*|himalaya\w*)\b/, 'momo'],
  [/\b(naan|tandoor\w*|tikka)\b/, 'naan'],
  [/\b(inde|indian\w*|delhi|mumbai|bombay|taj|maharaja\w*|punjab\w*|nepal\w*|everest|katmandou|namaste|curry\w*|masala|rajasthan)\b/, 'curry'],
  [/\b(couscous\w*)\b/, 'couscous'],
  [/\b(maroc\w*|marrakech|tajine\w*|tagine\w*|atlas|casbah|medina|kasbah|tunis\w*|alger\w*|riad|kabyle)\b/, 'tagine'],
  [/\b(dakar|senegal\w*|afric\w*|abidjan|bokit|caribbean|creole\w*|antill\w*|reunion\w*|akwaba|zouglou|yassa|mafe|ghana)\b/, 'african'],
  [/\b(paella\w*|valencia)\b/, 'paella'],
  [/\b(trattoria|osteria|ristorante|ristoro|pasta\w*|spaghetti|bella|nonna|roma|milano|venezia|toscana|sicilia|sardegna|dolce vita|etna|spaccanapoli|forno|vincenzo|italienne|italiano|mammina|tutto va bene)\b/, 'pasta'],
  [/\b(creperie\w*|crepe\w*|galette\w*|breizh|bretagne|bretonne?|cri'?perie)\b/, 'crepe'],
  [/\b(gaufre\w*|waffle\w*)\b/, 'waffle'],
  [/\b(brunch|pancake\w*)\b/, 'brunch'],
  [/\b(boulangerie\w*|boulanger\w*|fournil|patisserie\w*|viennois\w*|croissant\w*|le pain)\b/, 'croissant'],
  [/\b(glac\w*|gelato|sorbet\w*|ice cream)\b/, 'icecream'],
  [/\b(cafe\w*|coffee|torrefact\w*|barista|tea room|salon de the)\b/, 'coffee'],
  [/\b(bubble|boba)\b/, 'boba'],
  [/\b(vegan\w*|veggie|vegetarien\w*|salad\w*|healthy|bowls?|bio)\b/, 'salad'],
  [/\b(croque\w*)\b/, 'croque'],
  [/\b(sandwich\w*|panini\w*|bagel\w*|snack\w*|tartine\w*|wrap\w*|subway)\b/, 'sandwich'],
  [/\b(poisson\w*|huitre\w*|fruits de mer|maree|seafood|moules?|homard|pescador|huitrium)\b/, 'seafood'],
  [/\b(poulet\w*|chicken|rotisserie\w*|wings|kfc|popeyes|crousty|tenders|galinette|poule)\b/, 'chicken'],
  [/\b(fogo|pampa|asador|barbaque|sambodromo|churrasc\w*|asado|gaucho|chuleta|brazeiro|steakhouse|ribs?|bbq|barbecue)\b/, 'steakhouse'],
  [/\b(grill\w*|steak\w*|boucherie\w*|braise)\b/, 'steak'],
  [/\b(tapas|bodega\w*|espagn\w*|iberic\w*|chiringuito|tantina|borriquito|casita)\b/, 'tapas'],
  [/\b(bistrot\w*|bistro\w*|brasserie\w*|bouchon\w*)\b/, 'bistro'],
  [/\b(fondue\w*|raclette\w*|savoyard\w*|caquelon)\b/, 'fondue'],
  [/\b(cassoulet\w*|terroir\w*|auberge\w*|ferme)\b/, 'cassoulet'],
  [/\b(vino|vins?|wine\w*|cave|oenotheque|vigneron\w*)\b/, 'winebar'],
  [/\b(pub|biere\w*|brewery|brasseurs?|biergarten|beer\w*|taverne)\b/, 'beer'],
  [/\b(cocktail\w*|speakeasy|mixolog\w*|lounge|bar)\b/, 'cocktail'],
  [/\b(frite\w*|friterie\w*|fast food|food truck|poutine\w*)\b/, 'fries'],
];

/** Un nom sans ambiguïté l'emporte sur une cuisine générique (« Italien » + « Pizzeria Roma » = pizza). */
const STRONG_NAME: Rule[] = [
  [/\b(pizz\w*)\b/, 'pizza'],
  [/\b(burger\w*)\b/, 'burger'],
  [/\b(kebab\w*|doner|durum)\b/, 'kebab'],
  [/\b(yakitori\w*|izakaya\w*)\b/, 'yakitori'],
  [/\b(ramen\w*)\b/, 'ramen'],
  [/\b(sushi\w*|maki\w*)\b/, 'sushi'],
  [/\b(pho|viet ?nam\w*|banh mi|bo[ -]?bun|saigon|hanoi)\b/, 'vietnam'],
  [/\b(thai\w*)\b/, 'thai'],
  [/\b(creperie\w*)\b/, 'crepe'],
  [/\b(bistrot|bistro|brasserie)\b/, 'bistro'],
  [/\b(tacos?|french tacos)\b/, 'taco'],
  [/\b(poutine)\b/, 'fries'],
  [/\b(kasbah|casbah|riad|kabyle)\b/, 'tagine'],
  [/\b(miss fish|poisson\w*|huitre\w*)\b/, 'seafood'],
];

/** Icône précise pour ce restaurant, ou null si on n'a rien de fiable (à ne jamais remplacer par un tirage au hasard). */
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

/** Icônes « de la même famille » pour les satellites de couverture (aucun hasard). */
const FAMILY: Partial<Record<FoodSticker, [FoodSticker, FoodSticker]>> = {
  mezze: ['kebab', 'salad'], kebab: ['mezze', 'fries'], tagine: ['couscous', 'curry'], couscous: ['tagine', 'curry'],
  african: ['couscous', 'curry'], curry: ['tagine', 'african'], thai: ['ramen', 'vietnam'], vietnam: ['ramen', 'thai'],
  korean: ['ramen', 'dumpling'], chinese: ['dumpling', 'ramen'], ramen: ['dumpling', 'sushi'], sushi: ['ramen', 'dumpling'],
  dumpling: ['chinese', 'ramen'], french: ['bistro', 'croissant'], bistro: ['french', 'wine'], cassoulet: ['french', 'bistro'],
  crepe: ['brunch', 'coffee'], brunch: ['crepe', 'coffee'], seafood: ['sushi', 'wine'], tapas: ['wine', 'salad'],
  sandwich: ['croque', 'fries'], croque: ['sandwich', 'fries'], pizza: ['pasta', 'wine'], pasta: ['pizza', 'wine'],
  burger: ['fries', 'hotdog'], fries: ['burger', 'hotdog'], coffee: ['croissant', 'cupcake'], croissant: ['coffee', 'brunch'],
  // Lot 2
  falafel: ['mezze', 'salad'], poke: ['salad', 'sushi'], gyros: ['kebab', 'salad'], paella: ['seafood', 'tapas'],
  burrito: ['taco', 'fries'], cocktail: ['winebar', 'beer'], winebar: ['cocktail', 'tapas'], beer: ['fries', 'cocktail'],
  chicken: ['fries', 'burger'], yakitori: ['sushi', 'ramen'], naan: ['curry', 'tagine'], momo: ['dumpling', 'curry'],
  steakhouse: ['steak', 'fries'], waffle: ['brunch', 'icecream'], fondue: ['cassoulet', 'wine'],
};

/** 4 satellites autour de la couverture : étincelles + deux icônes de la famille de cuisine. */
export function satellitesFor(main: FoodSticker): [StickerName, StickerName, StickerName, StickerName] {
  const [a, b] = FAMILY[main] ?? ['sparkle', 'sparkle'];
  return [a, 'sparkle', b, 'sparkle'];
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
