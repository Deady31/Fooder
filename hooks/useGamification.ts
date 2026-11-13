'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { STORE_EVENT, readJson, writeJson } from '../lib/store';
import {
  ACH_KEY, ALL_ACHIEVEMENTS, Achievement, LEVEL_THRESHOLDS, XP_KEY, awardXp, computeLevel, readTotalXp, unlockAchievement,
} from '../lib/rewards';

// Données et calculs déplacés dans lib/rewards (source unique) ; ré-exportés ici pour les imports existants.
export { ACH_KEY, ALL_ACHIEVEMENTS, LEVEL_THRESHOLDS, XP_KEY, computeLevel };
export type { Achievement };

const STREAK_KEY = 'fooder_streak';

function readIds(): string[] {
  const raw = readJson<unknown>(ACH_KEY, []);
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** Série quotidienne : lue puis mise à jour une fois par jour, via lib/store. */
function touchDailyStreak(): number {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sd = readJson<{ count?: unknown; lastDate?: unknown } | null>(STREAK_KEY, null);
  const count = typeof sd?.count === 'number' && sd.count > 0 ? sd.count : 0;
  if (sd && sd.lastDate === today && count > 0) return count;
  const next = sd && sd.lastDate === yesterday ? count + 1 : 1;
  writeJson(STREAK_KEY, { count: next, lastDate: today });
  return next;
}

export function useGamification() {
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const idsRef = useRef<string[]>([]);

  useEffect(() => {
    const syncXp = () => {
      const total = readTotalXp();
      setXp(total);
      setLevel(computeLevel(total));
    };
    const syncIds = () => {
      idsRef.current = readIds();
      setUnlockedIds(idsRef.current);
    };

    setStreak(touchDailyStreak());
    syncXp();
    syncIds();
    setLoaded(true);

    // Toute écriture d'XP ou de succès (ici ou ailleurs : visites, amis, groupes, missions) passe par lib/store.
    const sync = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (key === XP_KEY) syncXp();
      if (key === ACH_KEY) syncIds();
    };
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, []);

  /** Compatibilité : passe par le chemin unique `awardXp` (stockage, événements xp/level). */
  const gainXP = useCallback((amount: number) => {
    awardXp(amount, 'swipe');
  }, []);

  const unlock = useCallback((id: string) => {
    if (!unlockAchievement(id)) return;
    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) setNewAchievement(achievement);
  }, []);

  const clearNewAchievement = useCallback(() => setNewAchievement(null), []);

  // Succès de niveau et de régularité.
  useEffect(() => {
    if (!loaded) return;
    if (level >= 5) unlock('level_5');
    if (level >= 10) unlock('level_10');
    if (streak >= 3) unlock('streak_3');
    if (streak >= 7) unlock('streak_7');
    if (streak >= 30) unlock('streak_30');
  }, [loaded, level, streak, unlock]);

  const xpStart = LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)];
  const xpEnd = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)];
  const xpProgress = xpEnd > xpStart ? (xp - xpStart) / (xpEnd - xpStart) : 1;

  return {
    streak, xp, level, xpProgress,
    unlockedIds,
    achievements: unlockedIds.map(id => ALL_ACHIEVEMENTS.find(a => a.id === id)!).filter(Boolean),
    newAchievement,
    clearNewAchievement,
    gainXP, unlock, loaded,
  };
}
