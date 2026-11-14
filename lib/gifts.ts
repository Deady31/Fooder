/**
 * Mes cadeaux : bons débloqués par niveau.
 * Aucun restaurant partenaire n'est signé : le catalogue est un EXEMPLE (étiqueté ainsi dans l'interface)
 * et il n'y a pas de bouton « Utiliser ». Le futur flux (QR de l'affiche du restaurateur scanné par l'app,
 * jeton à usage unique) est décrit dans docs/DECISION_LOG.md.
 */

export interface Gift {
  id: string;
  title: string;
  /** Niveau minimum pour débloquer le bon. */
  level: number;
  /** Vrai tant qu'aucun partenaire réel n'est rattaché au bon. */
  example: boolean;
}

export type GiftStatus = 'locked' | 'unlocked';

export const GIFTS: readonly Gift[] = [
  { id: 'coffee', title: 'Un café offert', level: 3, example: true },
  { id: 'dessert', title: 'Un dessert offert', level: 5, example: true },
  { id: 'starter', title: 'Une entrée offerte', level: 7, example: true },
  { id: 'main', title: 'Un plat offert', level: 10, example: true },
];

export function giftStatus(gift: Pick<Gift, 'level'>, level: number): GiftStatus {
  return Number.isFinite(level) && level >= gift.level ? 'unlocked' : 'locked';
}

/** Prochain bon à débloquer (le plus proche), undefined s'ils le sont tous. */
export function nextGift(level: number, gifts: readonly Gift[] = GIFTS): Gift | undefined {
  return gifts.filter(g => giftStatus(g, level) === 'locked').sort((a, b) => a.level - b.level)[0];
}

/** Vrai s'il reste au moins un bon sans partenaire réel : l'interface affiche alors l'étiquette « exemple ». */
export const hasExampleGifts = (gifts: readonly Gift[] = GIFTS): boolean => gifts.some(g => g.example);
