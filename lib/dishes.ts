import manifest from '../data/dishPhotos.json';

/**
 * Photos de plats typiques par cuisine, libres de droit (Wikimedia Commons : CC0, domaine public, CC BY, CC BY-SA).
 * Elles illustrent un type de plat, pas un restaurant précis : l'interface l'indique toujours et crédite l'auteur.
 */
export interface DishPhoto {
  key: string;
  src: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  page: string;
}

const MANIFEST = manifest as Record<string, Omit<DishPhoto, 'key'>>;

export const DISH_KEYS = Object.keys(MANIFEST);

export function dishPhoto(key: string): DishPhoto | null {
  const m = MANIFEST[key];
  return m ? { key, ...m } : null;
}

export const allDishPhotos = (): DishPhoto[] => [...DISH_KEYS].sort().map(k => ({ key: k, ...MANIFEST[k] }));

const fold = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Rule = [RegExp, string];

/** Cuisine connue → clé de photo (le plus spécifique d'abord). */
const CUISINE_RULES: Rule[] = [
  // Plats nommés explicitement : une seule photo, celle du plat.
  [/cassoulet/, 'terroir_cassoulet'],
  [/tartare/, 'steak_tartare'],
  [/\bmoules?\b/, 'seafood_moules'],
  [/fish.?and.?chips/, 'fries_fishchips'],
  [/banh.?mi|bahn.?mi/, 'pho_banhmi'],
  [/\bbao\b/, 'wok_bao'],
  [/acai/, 'vegan_acai'],
  [/nachos/, 'tacos_nachos'],
  [/empanada/, 'argentine_empanadas'],
  [/ceviche/, 'peruvian_ceviche'],
  [/tiramisu/, 'dessert_tiramisu'],
  [/pizz/, 'pizza'],
  [/hot.?dog/, 'hotdog'],
  [/tacos|taco|mexic|tex.?mex|burrito|fajita/, 'tacos'],
  [/burger|americain|diner/, 'burger'],
  [/falafel/, 'falafel'],
  [/kebab|doner|durum|shawarma|turc/, 'kebab'],
  [/grec|gyros|souvlaki/, 'greek'],
  [/libanais|liban|mezze|syrien|oriental|arabe|moyen.?orient|israelien|armenien/, 'lebanese'],
  [/sushi|maki|sashimi|izakaya|yakitori|japonais|japanese|japan/, 'sushi'],
  [/ramen|udon/, 'ramen'],
  [/vietnam|\bpho\b/, 'pho'],
  [/thai|laotien|cambodgien/, 'thai'],
  [/dim.?sum|raviol|gyoza|dumpling/, 'dimsum'],
  [/chinois|chinese|cantonais|sichuan|pekin/, 'chinese'],
  [/coreen|korean/, 'korean'],
  [/wok|nouille|noodle|asiat|asian|indonesien|malaisien|taiwan/, 'wok'],
  [/poke/, 'poke'],
  [/nepal|tibetain|himalay/, 'nepali'],
  [/indien|indian|curry|tandoor|pakistan|sri.?lank|bengali/, 'indian'],
  [/marocain|tajine|tagine|maghreb/, 'moroccan'],
  [/couscous|tunisien|algerien/, 'couscous'],
  [/africain|african|ethiopien|senegalais|camerounais|ivoirien|congolais|malgache|creole|caribeen|caribbean|antillais|reunion/, 'african'],
  [/paella/, 'paella'],
  [/tapas|espagnol|spanish|pintxo/, 'tapas'],
  [/fondue|raclette|savoyard|tartiflette/, 'fondue'],
  [/crepe|galette/, 'crepe'],
  [/gaufre|waffle|belge|belgian/, 'waffle'],
  [/boulang|bakery|patiss|viennois|croissant/, 'bakery'],
  [/glace|gelato|ice.?cream|sorbet/, 'icecream'],
  [/dessert|gateau|cake|cupcake|macaron/, 'dessert'],
  [/bubble|boba/, 'boba'],
  [/salon de the|coffee|cafe|torrefact|barista/, 'coffee'],
  [/brunch|pancake|breakfast/, 'brunch'],
  [/vegetarien|vegan|vegetalien|healthy|bio\b/, 'vegan'],
  [/salad|salade/, 'salad'],
  [/sandwich|panini|bagel|croque|\bsub\b|wrap|tartine/, 'sandwich'],
  [/argentin|argentine/, 'argentine'],
  [/bresil|brazil/, 'brazilian'],
  [/perou|peru/, 'peruvian'],
  [/poisson|fruits de mer|seafood|huitre|moule|crustace/, 'seafood'],
  [/poulet|chicken|rotisserie|wings/, 'chicken'],
  [/steak|grill|viande|boucher|barbecue|bbq|brochette/, 'steak'],
  [/frite|friture|friterie|fast.?food|street|crousty|tenders|nuggets/, 'fries'],
  [/pates|pasta|trattoria|osteria|italien|italian|ristorante/, 'pasta'],
  [/terroir|sud.?ouest|cassoulet|toulousain|occitan|regional|local/, 'terroir'],
  [/gastronom|etoile|fine.?dining|creatif|creative/, 'gastro'],
  [/bistro|brasserie|bouchon|traditional|traditionnel/, 'bistro'],
  [/francais|french/, 'french'],
];

/** Mots du nom quand la cuisine est inconnue. */
const NAME_RULES: Rule[] = [
  [/\b(pizz\w*|pizzeria)\b/, 'pizza'],
  [/\b(burger\w*|smash)\b/, 'burger'],
  [/\b(taco\w*|cantina|hacienda|mexic\w*|burrito\w*)\b/, 'tacos'],
  [/\b(cassoulet\w*)\b/, 'terroir_cassoulet'],
  [/\b(tartare\w*)\b/, 'steak_tartare'],
  [/\b(banh mi|bahn mi)\b/, 'pho_banhmi'],
  [/\b(acai)\b/, 'vegan_acai'],
  [/\b(ceviche\w*)\b/, 'peruvian_ceviche'],
  [/\b(falafel\w*)\b/, 'falafel'],
  [/\b(kebab\w*|kebap|doner|durum|istanbul|anatolie|ottoman\w*|sultan|bosphore|efes)\b/, 'kebab'],
  [/\b(beyrouth|liban\w*|cedre|cedres|mezze\w*|damas|byblos)\b/, 'lebanese'],
  [/\b(sushi\w*|maki\w*|tokyo|osaka|kyoto|sakura|fuji|yamato|izakaya|tempura)\b/, 'sushi'],
  [/\b(ramen\w*|udon)\b/, 'ramen'],
  [/\b(pho|hanoi|saigon|vietnam\w*)\b/, 'pho'],
  [/\b(bangkok|siam|thai\w*)\b/, 'thai'],
  [/\b(dragon\w*|pekin|shanghai|canton\w*|chine|chinois\w*|dim sum)\b/, 'chinese'],
  [/\b(seoul|coree\w*|bibimbap)\b/, 'korean'],
  [/\b(wok\w*|nouille\w*|bao)\b/, 'wok'],
  [/\b(inde|indian\w*|delhi|mumbai|bombay|taj|maharaja\w*|punjab\w*|tandoor\w*|curry\w*|masala)\b/, 'indian'],
  [/\b(nepal\w*|himalaya\w*|everest|katmandou|namaste)\b/, 'nepali'],
  [/\b(maroc\w*|marrakech|tajine\w*|atlas|casbah|medina|kasbah)\b/, 'moroccan'],
  [/\b(couscous\w*|tunis\w*|alger\w*)\b/, 'couscous'],
  [/\b(dakar|senegal\w*|afric\w*|abidjan)\b/, 'african'],
  [/\b(trattoria|osteria|ristorante|ristoro|pasta\w*|spaghetti|nonna|venezia|toscana|sicilia|dolce vita)\b/, 'pasta'],
  [/\b(creperie\w*|crepe\w*|galette\w*|breizh|bretagne|bretonne?)\b/, 'crepe'],
  [/\b(gaufre\w*|waffle\w*)\b/, 'waffle'],
  [/\b(boulangerie\w*|boulanger\w*|fournil|patisserie\w*|viennois\w*|croissant\w*|le pain)\b/, 'bakery'],
  [/\b(glac\w*|gelato|sorbet\w*)\b/, 'icecream'],
  [/\b(cafe\w*|coffee|torrefact\w*|barista|tea room)\b/, 'coffee'],
  [/\b(bubble|boba)\b/, 'boba'],
  [/\b(vegan\w*|veggie|vegetarien\w*|healthy)\b/, 'vegan'],
  [/\b(salad\w*|bowl\w*)\b/, 'salad'],
  [/\b(poke\w*)\b/, 'poke'],
  [/\b(sandwich\w*|panini\w*|bagel\w*|croque\w*|tartine\w*|wrap\w*|subway)\b/, 'sandwich'],
  [/\b(poulet\w*|chicken|rotisserie\w*|wings)\b/, 'chicken'],
  [/\b(grill\w*|steak\w*|boucherie\w*|bbq|barbecue|churrasco|asado|gaucho)\b/, 'steak'],
  [/\b(fruits de mer|huitre\w*|oyster\w*|poisson\w*|moules?|crustace\w*)\b/, 'seafood'],
  [/\b(tapas|pintxo\w*)\b/, 'tapas'],
  [/\b(paella\w*)\b/, 'paella'],
  [/\b(fondue|raclette|savoyard\w*)\b/, 'fondue'],
  [/\b(frite\w*|friterie\w*|fast food|food truck|crousty|tenders)\b/, 'fries'],
  [/\b(cassoulet\w*|toulousain\w*|occitan\w*)\b/, 'terroir'],
  [/\b(bistrot|bistro|brasserie|bouchon)\b/, 'bistro'],
];

/** Clé de la photo de plat typique pour ce restaurant, ou null si on ne sait pas honnêtement (alors : illustration). */
export function dishKeyFor(cuisine: string, name = ''): string | null {
  const c = fold(cuisine);
  const n = fold(name);
  // Un nom explicite l'emporte sur une cuisine générique (« Italien » + « Pizzeria Roma »).
  const strong = NAME_RULES.find(([re, key], i) => (i < 3 || key.includes('_')) && re.test(n));
  if (strong) return strong[1];
  const byCuisine = CUISINE_RULES.find(([re]) => re.test(c));
  if (byCuisine && MANIFEST[byCuisine[1]]) return byCuisine[1];
  const byName = NAME_RULES.find(([re]) => re.test(n));
  return byName && MANIFEST[byName[1]] ? byName[1] : null;
}

/**
 * Photos supplémentaires d'une même cuisine (clé de base → autres assiettes typiques), pour que les cartes
 * d'une même cuisine ne montrent pas toutes la même photo.
 */
const VARIANTS: Record<string, string[]> = {
  thai: ['thai_padthai', 'thai_tomyum', 'thai_greencurry'],
  korean: ['korean_bibimbap', 'korean_chicken', 'korean_bulgogi'],
  sushi: ['sushi_tempura', 'sushi_katsucurry', 'sushi_okonomiyaki', 'sushi_yakitori'],
  ramen: ['ramen_tonkotsu', 'dimsum_gyoza'],
  dimsum: ['dimsum_gyoza', 'wok_bao'],
  pho: ['pho_bun', 'pho_banhmi', 'pho_nem'],
  chinese: ['chinese_duck', 'chinese_friedrice', 'wok_bao'],
  wok: ['wok_bao', 'wok_padseeew', 'chinese_friedrice'],
  indian: ['indian_butterchicken', 'indian_tandoori', 'indian_biryani', 'indian_samosa', 'indian_dal', 'indian_naan'],
  moroccan: ['moroccan_tajine', 'moroccan_pastilla'],
  couscous: ['couscous_royal', 'moroccan_tajine'],
  kebab: ['kebab_shawarma', 'kebab_durum'],
  lebanese: ['lebanese_hummus', 'lebanese_mezze', 'kebab_shawarma'],
  falafel: ['falafel_plate', 'lebanese_hummus'],
  greek: ['greek_moussaka', 'greek_gyros'],
  tapas: ['tapas_bravas', 'tapas_tortilla'],
  paella: ['paella_valenciana'],
  pizza: ['pizza_margherita', 'pizza_quattro'],
  pasta: ['pasta_lasagna', 'pasta_carbonara', 'pasta_risotto'],
  dessert: ['dessert_tiramisu', 'dessert_fondant'],
  terroir: ['terroir_cassoulet', 'terroir_magret', 'terroir_confit', 'terroir_saucisse'],
  french: ['french_bourguignon', 'french_oignon', 'steak_frites', 'terroir_confit'],
  bistro: ['bistro_entrecote', 'steak_frites', 'french_oignon'],
  steak: ['steak_frites', 'steak_tartare', 'steak_brochettes', 'bistro_entrecote'],
  seafood: ['seafood_moules'],
  sandwich: ['sandwich_croque', 'pho_banhmi'],
  crepe: ['crepe_galette', 'crepe_sucre'],
  burger: ['burger_smash', 'burger_cheese'],
  fries: ['fries_fishchips', 'burger_cheese'],
  poke: ['poke_bowl'],
  vegan: ['vegan_acai'],
  tacos: ['tacos_nachos', 'tacos_fajitas'],
  peruvian: ['peruvian_ceviche'],
  argentine: ['argentine_empanadas', 'steak_brochettes'],
  brunch: ['brunch_benedict', 'brunch_pancakes'],
  waffle: ['waffle_gaufre'],
  salad: ['salad_caesar'],
  bakery: ['bakery_croissant'],
  icecream: ['icecream_cone'],
  chicken: ['chicken_rotisserie'],
};

/** Toutes les photos possibles pour une cuisine : la clé de base d'abord, puis les variantes présentes dans le manifest. */
export function dishVariants(key: string): string[] {
  return [key, ...(VARIANTS[key] ?? [])].filter((k, i, a) => !!MANIFEST[k] && a.indexOf(k) === i);
}

/** Hash FNV-1a 32 bits : stable d'une exécution à l'autre (jamais de Math.random). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Photo de plat typique pour ce restaurant, ou null si on ne sait pas honnêtement.
 * Avec une graine (l'identifiant du resto), choisit de façon déterministe parmi les photos de la cuisine ;
 * sans graine, renvoie la photo de base (comportement historique).
 */
export function dishPhotoFor(cuisine: string, name = '', seed?: string): DishPhoto | null {
  const key = dishKeyFor(cuisine, name);
  if (!key) return null;
  if (!seed) return dishPhoto(key);
  const options = dishVariants(key);
  return dishPhoto(options.length ? options[hash(seed) % options.length] : key);
}
