import type { StickerName } from '../../lib/stickers';
import type { AgeRange, Diet, Gender } from '../../lib/profile';

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

export function labelOf<T>(options: Option<T>[], value: T | null): string | null {
  return options.find(o => o.value === value)?.label ?? null;
}
