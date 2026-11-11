'use client';
import { useState, useEffect, useCallback } from 'react';

const KEY = 'fooder_missions';

export interface Mission {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
}

const TEMPLATES: Omit<Mission, 'current' | 'completed'>[] = [
  { id: 'swipe_5', title: '5 restos explorés', description: 'Swipe 5 restaurants', emoji: '👆', target: 5, xpReward: 25 },
  { id: 'like_3', title: '3 coups de cœur', description: 'Like 3 restaurants', emoji: '❤️', target: 3, xpReward: 50 },
  { id: 'open_detail', title: 'Curieux gourmand', description: 'Consulte 1 détail resto', emoji: '📖', target: 1, xpReward: 15 },
  { id: 'swipe_10', title: 'Explorateur actif', description: 'Swipe 10 restaurants', emoji: '🗺️', target: 10, xpReward: 40 },
  { id: 'like_cheap', title: 'Bon plan trouvé', description: 'Like un resto < 15€', emoji: '💸', target: 1, xpReward: 30 },
  { id: 'dislike_5', title: 'Difficile à séduire', description: 'Passe 5 restaurants', emoji: '😤', target: 5, xpReward: 20 },
  { id: 'like_premium', title: 'Gastronome', description: 'Like un resto > 50€', emoji: '🍷', target: 1, xpReward: 35 },
  { id: 'swipe_20', title: 'Swipe addict', description: 'Swipe 20 restaurants', emoji: '🔥', target: 20, xpReward: 60 },
];

function pickMissions(date: string): Mission[] {
  const seed = date.split('-').reduce((a, c) => a + parseInt(c), 0);
  const shuffled = [...TEMPLATES].sort((a, b) => ((seed * a.id.length) % 11) - ((seed * b.id.length) % 11));
  return shuffled.slice(0, 3).map(t => ({ ...t, current: 0, completed: false }));
}

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (stored?.date === today) {
      setMissions(stored.missions);
    } else {
      const fresh = pickMissions(today);
      localStorage.setItem(KEY, JSON.stringify({ date: today, missions: fresh }));
      setMissions(fresh);
    }
  }, []);

  const progress = useCallback((id: string, amount = 1): Mission | null => {
    const today = new Date().toISOString().split('T')[0];
    let completed: Mission | null = null;
    setMissions(prev => {
      const next = prev.map(m => {
        if (m.id !== id || m.completed) return m;
        const newCurrent = Math.min(m.current + amount, m.target);
        const done = newCurrent >= m.target;
        if (done) completed = { ...m, current: newCurrent, completed: true };
        return { ...m, current: newCurrent, completed: done };
      });
      localStorage.setItem(KEY, JSON.stringify({ date: today, missions: next }));
      return next;
    });
    return completed;
  }, []);

  const completedCount = missions.filter(m => m.completed).length;

  return { missions, progress, completedCount };
}
