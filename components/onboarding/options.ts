import type { StickerName } from '../../lib/stickers';
import type { AgeRange, Aversion, BudgetLevel, Companion, Diet, Frequency, Gender, Vibe } from '../../lib/profile';

export interface Option<T> {
  value: T;
  label: string;
  sub?: string;
  sticker?: StickerName;
}

export const GENDER_OPTIONS: Option<Gender>[] = [
  { value: 'female', label: 'Femme' },
  { value: 'male', label: 'Homme' },
  { value: 'other', label: 'Autre' },
  { value: 'unspecified', label: 'Je préfère ne pas dire' },
];

export const AGE_OPTIONS: Option<AgeRange>[] = [
  { value: 'u18', label: 'Moins de 18 ans' },
  { value: '18_24', label: '18-24 ans' },
  { value: '25_34', label: '25-34 ans' },
  { value: '35_44', label: '35-44 ans' },
  { value: '45_54', label: '45-54 ans' },
  { value: '55_plus', label: '55 ans et plus' },
];

export const DIET_OPTIONS: Option<Diet>[] = [
  { value: 'vegetarian', label: 'Végétarien', sticker: 'salad' },
  { value: 'vegan', label: 'Vegan', sticker: 'b_heart' },
  { value: 'halal', label: 'Halal', sticker: 'kebab' },
  { value: 'gluten_free', label: 'Sans gluten', sticker: 'plate' },
];

export const BUDGET_OPTIONS: Option<BudgetLevel>[] = [
  { value: 1, label: '€  Petit prix', sub: "Jusqu'à 20 € par personne", sticker: 'fries' },
  { value: 2, label: '€€  Confortable', sub: '20 à 40 € par personne', sticker: 'plate' },
  { value: 3, label: '€€€  On se fait plaisir', sub: '40 € et plus par personne', sticker: 'steak' },
];

export const VIBE_OPTIONS: Option<Vibe>[] = [
  { value: 'calm', label: 'Calme', sticker: 'coffee' },
  { value: 'festive', label: 'Festif', sticker: 'wine' },
  { value: 'romantic', label: 'Romantique', sticker: 'cupcake' },
  { value: 'friends', label: 'Entre amis', sticker: 'pizza' },
  { value: 'quick', label: 'Rapide', sticker: 'hotdog' },
  { value: 'terrace', label: 'Terrasse', sticker: 'icecream' },
];

export const FREQUENCY_OPTIONS: Option<Frequency>[] = [
  { value: 'rarely', label: 'Rarement', sub: "Moins d'une fois par mois" },
  { value: 'monthly', label: 'De temps en temps', sub: '1 à 3 fois par mois' },
  { value: 'weekly', label: 'Régulièrement', sub: '1 à 2 fois par semaine' },
  { value: 'often', label: 'Tout le temps', sub: '3 fois par semaine ou plus' },
];

export const AVERSION_OPTIONS: Option<Aversion>[] = [
  { value: 'raw_fish', label: 'Poisson cru', sticker: 'sushi' },
  { value: 'spicy', label: 'Épicé', sticker: 'b_flame' },
  { value: 'seafood', label: 'Fruits de mer', sticker: 'seafood' },
  { value: 'offal', label: 'Abats', sticker: 'steak' },
  { value: 'cilantro', label: 'Coriandre', sticker: 'salad' },
  { value: 'other', label: 'Autre', sticker: 'sparkle' },
];

export const COMPANION_OPTIONS: Option<Companion>[] = [
  { value: 'solo', label: 'Seul(e)', sticker: 'ramen' },
  { value: 'couple', label: 'En couple', sticker: 'b_heart' },
  { value: 'friends', label: 'Entre amis', sticker: 'pizza' },
  { value: 'family', label: 'En famille', sticker: 'plate' },
  { value: 'colleagues', label: 'Entre collègues', sticker: 'sandwich' },
];

export function labelOf<T>(options: Option<T>[], value: T | null): string | null {
  return options.find(o => o.value === value)?.label ?? null;
}
