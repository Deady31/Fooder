import data from '../data/buffets.json';

/** Identifiant de l'envie « Buffet à volonté » (feuille « T'as envie de quoi ? »). */
export const BUFFET_MOOD = 'buffet';

export type BuffetStatus = 'confirmed' | 'to_confirm' | 'excluded';

export interface BuffetEntry {
  /** Identifiant dans data/toulouse-places.json ; absent si le lieu n'est pas encore dans la base. */
  id?: string;
  name: string;
  status: BuffetStatus;
  reason?: string;
  verifiedAt: string;
  sources: string[];
}

export const BUFFET_ENTRIES: readonly BuffetEntry[] = data.entries as BuffetEntry[];

/** Restos dont la formule à volonté est confirmée. Un resto sans horaires lisibles reste masqué (règle générale des fiches). */
export const BUFFET_IDS: ReadonlySet<string> = new Set(
  BUFFET_ENTRIES.filter(e => e.status === 'confirmed' && e.id).map(e => e.id as string)
);

export const isBuffet = (id: string): boolean => BUFFET_IDS.has(id);
