export interface MissionLike {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  xpReward: number;
  current: number;
  completed: boolean;
}

/** Anciens ids de mission -> id actuel. */
const LEGACY_IDS: Record<string, string> = { like_premium: 'like_gastro' };

/** Convertit les ids obsolètes d'un jeu de missions déjà stocké (progression conservée, doublons retirés). */
export function migrateMissionIds<T extends MissionLike>(
  stored: readonly T[] | null | undefined,
  templates: readonly Omit<MissionLike, 'current' | 'completed'>[]
): T[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of stored) {
    const id = LEGACY_IDS[m.id] ?? m.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const tpl = id !== m.id ? templates.find(t => t.id === id) : undefined;
    out.push(id === m.id ? m : { ...m, ...(tpl ?? {}), id });
  }
  return out;
}
