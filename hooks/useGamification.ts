'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { pushNotification } from '../lib/notifications';
import { STORE_EVENT } from '../lib/store';

const STREAK_KEY = 'fooder_streak';
export const XP_KEY = 'fooder_xp';
export const ACH_KEY = 'fooder_achievements';

export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 5000];

export interface Achievement {
  id: string;
  title: string;
  emoji: string;
  description: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_swipe', title: 'Premier swipe !', emoji: '👆', description: 'Ton tout premier swipe' },
  { id: 'first_like', title: 'Coup de cœur', emoji: '❤️', description: 'Premier restaurant liké' },
  { id: 'streak_3', title: '3 jours foodie', emoji: '🔥', description: '3 jours consécutifs' },
  { id: 'streak_7', title: 'Semaine parfaite', emoji: '🏆', description: '7 jours de streak' },
  { id: 'streak_30', title: 'Addict officiel', emoji: '👑', description: '30 jours de streak' },
  { id: 'likes_10', title: 'Gourmet confirmé', emoji: '😋', description: '10 restaurants likés' },
  { id: 'likes_50', title: 'Grand Explorateur', emoji: '🗺️', description: '50 restaurants likés' },
  { id: 'level_5', title: 'Niveau 5 atteint', emoji: '⭐', description: 'Rang intermédiaire' },
  { id: 'level_10', title: 'Maître Foodie', emoji: '🌟', description: 'Rang maximum' },
  { id: 'cheap_hunter', title: 'Street Foodie', emoji: '🌮', description: '5 restos likés < 15€' },
  { id: 'gasto_hunter', title: 'Gastro Hunter', emoji: '🥂', description: '3 restos likés > 80€' },
  { id: 'swipes_100', title: 'Machine à swiper', emoji: '💪', description: '100 swipes au total' },
  { id: 'casino_win', title: 'Lucky Foodie', emoji: '🎰', description: 'Décroché un jackpot !' },
  { id: 'visit_1', title: 'Premier verdict', emoji: '📍', description: 'Première visite confirmée' },
  { id: 'visits_10', title: 'Critique en herbe', emoji: '📝', description: '10 visites confirmées' },
  { id: 'week_streak_4', title: 'Un mois de découvertes', emoji: '🔥', description: '4 semaines de série' },
  { id: 'quartiers_5', title: 'Cartographe', emoji: '🗺️', description: '5 quartiers explorés' },
  { id: 'photo_1', title: 'Éclaireur', emoji: '📸', description: 'Première vraie photo publiée' },
  { id: 'photos_5', title: 'Reporter', emoji: '🎞️', description: '5 vraies photos publiées' },
  { id: 'friend_1', title: 'Premier ami', emoji: '🤝', description: 'Un ami ajouté' },
  { id: 'friends_5', title: 'La bande', emoji: '👯', description: '5 amis ajoutés' },
  { id: 'group_1', title: 'Chef de tablée', emoji: '🍽️', description: 'Une décision à plusieurs' },
  { id: 'defi_1', title: 'Défi relevé', emoji: '🎯', description: 'Un défi à l’aveugle relevé' },
];

export function computeLevel(totalXp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) return Math.min(i + 1, 10);
  }
  return 1;
}

export function useGamification() {
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Valeurs courantes lues hors des updaters setState : aucun effet de bord (stockage, notification) pendant le rendu.
  const xpRef = useRef(0);
  const idsRef = useRef<string[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const rawStreak = localStorage.getItem(STREAK_KEY);
    const sd = rawStreak ? JSON.parse(rawStreak) : null;
    let newStreak = 1;
    if (sd) {
      if (sd.lastDate === today) {
        newStreak = sd.count;
      } else if (sd.lastDate === yesterday) {
        newStreak = sd.count + 1;
        localStorage.setItem(STREAK_KEY, JSON.stringify({ count: newStreak, lastDate: today }));
      } else {
        newStreak = 1;
        localStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastDate: today }));
      }
    } else {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastDate: today }));
    }
    setStreak(newStreak);

    const rawXp = localStorage.getItem(XP_KEY);
    const totalXp = rawXp ? JSON.parse(rawXp).total ?? 0 : 0;
    xpRef.current = totalXp;
    setXp(totalXp);
    setLevel(computeLevel(totalXp));

    const rawAch = localStorage.getItem(ACH_KEY);
    idsRef.current = rawAch ? JSON.parse(rawAch) : [];
    setUnlockedIds(idsRef.current);
    setLoaded(true);

    // Récompenses données ailleurs (visites, amis, groupes) : on se resynchronise.
    const sync = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (key !== XP_KEY && key !== ACH_KEY) return;
      const total = JSON.parse(localStorage.getItem(XP_KEY) || '{}').total ?? 0;
      xpRef.current = total;
      setXp(total);
      setLevel(computeLevel(total));
      idsRef.current = JSON.parse(localStorage.getItem(ACH_KEY) || '[]');
      setUnlockedIds(idsRef.current);
    };
    window.addEventListener(STORE_EVENT, sync);
    return () => window.removeEventListener(STORE_EVENT, sync);
  }, []);

  const gainXP = useCallback((amount: number) => {
    const newTotal = xpRef.current + amount;
    xpRef.current = newTotal;
    const rawXp = localStorage.getItem(XP_KEY);
    const existing = rawXp ? JSON.parse(rawXp) : {};
    localStorage.setItem(XP_KEY, JSON.stringify({ ...existing, total: newTotal }));
    setXp(newTotal);
    setLevel(computeLevel(newTotal));
  }, []);

  const unlock = useCallback((id: string) => {
    if (idsRef.current.includes(id)) return;
    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return;
    const newIds = [...idsRef.current, id];
    idsRef.current = newIds;
    localStorage.setItem(ACH_KEY, JSON.stringify(newIds));
    setUnlockedIds(newIds);
    setNewAchievement(achievement);
    pushNotification({ id: `ach-${id}`, kind: 'achievement', title: achievement.title, body: achievement.description, ref: id });
  }, []);

  // Succès de niveau et de régularité (jamais débloqués jusqu'ici).
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
    clearNewAchievement: () => setNewAchievement(null),
    gainXP, unlock, loaded,
  };
}
