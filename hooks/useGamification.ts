'use client';
import { useState, useEffect, useCallback } from 'react';
import { pushNotification } from '../lib/notifications';

const STREAK_KEY = 'fooder_streak';
const XP_KEY = 'fooder_xp';
const ACH_KEY = 'fooder_achievements';

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 5000];

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
  { id: 'premium', title: 'Club Premium', emoji: '✨', description: 'Membre Premium Fooder' },
  { id: 'casino_win', title: 'Lucky Foodie', emoji: '🎰', description: 'Décroché un jackpot !' },
];

function computeLevel(totalXp: number): number {
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
    setXp(totalXp);
    setLevel(computeLevel(totalXp));

    const rawAch = localStorage.getItem(ACH_KEY);
    setUnlockedIds(rawAch ? JSON.parse(rawAch) : []);
    setLoaded(true);
  }, []);

  const gainXP = useCallback((amount: number) => {
    setXp(prev => {
      const newTotal = prev + amount;
      const rawXp = localStorage.getItem(XP_KEY);
      const existing = rawXp ? JSON.parse(rawXp) : {};
      localStorage.setItem(XP_KEY, JSON.stringify({ ...existing, total: newTotal }));
      setLevel(computeLevel(newTotal));
      return newTotal;
    });
  }, []);

  const unlock = useCallback((id: string) => {
    setUnlockedIds(prev => {
      if (prev.includes(id)) return prev;
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (!achievement) return prev;
      const newIds = [...prev, id];
      localStorage.setItem(ACH_KEY, JSON.stringify(newIds));
      setNewAchievement(achievement);
      pushNotification({ id: `ach-${id}`, kind: 'achievement', title: achievement.title, body: achievement.description, ref: id });
      return newIds;
    });
  }, []);

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
