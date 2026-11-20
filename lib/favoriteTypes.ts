import type { Restaurant } from '../data/mockRestaurants';
import { isBuffet } from './buffets';
import { matchSticker, type FoodSticker, type StickerName } from './stickers';

/**
 * Types de restaurant pour trier les coups de cœur (liste et carte) : une dizaine de familles lisibles sur mobile,
 * déduites de l'icône déjà associée à chaque resto (voir lib/stickers.ts), plus le drapeau « buffet à volonté ».
 */
export type FamilyId = 'asie' | 'orient' | 'street' | 'pizza' | 'terroir' | 'monde' | 'cafe' | 'veg' | 'bar' | 'buffet' | 'autre';

export interface Family {
  id: FamilyId;
  label: string;
  sticker: StickerName;
}

/** Ordre d'affichage en cas d'égalité de nombre. */
export const FAMILIES: readonly Family[] = [
  { id: 'asie', label: 'Asie', sticker: 'ramen' },
  { id: 'street', label: 'Burger & street', sticker: 'burger' },
  { id: 'pizza', label: 'Pizza & pâtes', sticker: 'pizza' },
  { id: 'terroir', label: 'Terroir', sticker: 'french' },
  { id: 'orient', label: 'Orient', sticker: 'kebab' },
  { id: 'monde', label: 'Monde', sticker: 'tapas' },
  { id: 'cafe', label: 'Café & douceurs', sticker: 'coffee' },
  { id: 'veg', label: 'Végé', sticker: 'salad' },
  { id: 'bar', label: 'Bars', sticker: 'cocktail' },
  { id: 'buffet', label: 'Buffet à volonté', sticker: 'paella' },
  { id: 'autre', label: 'Autres', sticker: 'plate' },
];

const FAMILY_IDS: ReadonlySet<string> = new Set(FAMILIES.map(f => f.id));
export const familyLabel = (id: FamilyId): string => FAMILIES.find(f => f.id === id)?.label ?? id;

/** Famille de chaque icône de plat. `Record` exhaustif : une nouvelle icône sans famille ne compile pas. */
const FAMILY_OF_STICKER: Record<FoodSticker, Exclude<FamilyId, 'buffet'>> = {
  ramen: 'asie', sushi: 'asie', dumpling: 'asie', chinese: 'asie', thai: 'asie', vietnam: 'asie', korean: 'asie', momo: 'asie',
  poke: 'asie', yakitori: 'asie', curry: 'asie', naan: 'asie',
  kebab: 'orient', mezze: 'orient', falafel: 'orient', gyros: 'orient', tagine: 'orient', couscous: 'orient',
  burger: 'street', fries: 'street', hotdog: 'street', taco: 'street', burrito: 'street', sandwich: 'street', croque: 'street', chicken: 'street',
  pizza: 'pizza', pasta: 'pizza',
  french: 'terroir', bistro: 'terroir', cassoulet: 'terroir', steak: 'terroir', steakhouse: 'terroir', fondue: 'terroir', seafood: 'terroir',
  african: 'monde', paella: 'monde', tapas: 'monde',
  coffee: 'cafe', brunch: 'cafe', croissant: 'cafe', crepe: 'cafe', waffle: 'cafe', boba: 'cafe', cupcake: 'cafe', donut: 'cafe', icecream: 'cafe',
  salad: 'veg',
  beer: 'bar', cocktail: 'bar', wine: 'bar', winebar: 'bar',
  plate: 'autre',
};

type Classifiable = Pick<Restaurant, 'id' | 'name' | 'cuisine'>;

/** Familles d'un resto : celle de sa cuisine, plus « buffet à volonté » si c'en est un. Au moins une. */
export function familiesOf(r: Classifiable): FamilyId[] {
  const sticker = matchSticker(r.cuisine ?? '', r.name ?? '') ?? 'plate';
  const main = FAMILY_OF_STICKER[sticker];
  return isBuffet(r.id) ? [main, 'buffet'] : [main];
}

export interface FamilyCount {
  family: Family;
  count: number;
}

/** Familles présentes dans la liste avec leur nombre de restos, du plus fréquent au moins fréquent. Vide s'il n'y en a aucune. */
export function countFamilies(list: readonly Classifiable[]): FamilyCount[] {
  const counts = new Map<FamilyId, number>();
  for (const r of list) for (const id of familiesOf(r)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return FAMILIES.map(family => ({ family, count: counts.get(family.id) ?? 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Restos de la famille demandée ; `null` : aucun filtre, la liste est rendue telle quelle. */
export function filterByFamily<T extends Classifiable>(list: readonly T[], family: FamilyId | null): T[] {
  if (family === null) return [...list];
  return list.filter(r => familiesOf(r).includes(family));
}

/** Lit un identifiant de famille venu de l'adresse ou du stockage ; `null` si absent ou inconnu. */
export function parseFamily(value: unknown): FamilyId | null {
  return typeof value === 'string' && FAMILY_IDS.has(value) ? (value as FamilyId) : null;
}
