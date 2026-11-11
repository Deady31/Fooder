'use client';
import { useState, useEffect } from 'react';
import { Restaurant } from '../data/mockRestaurants';

const KEY = 'fooder_daily_picks';

export interface DailyPick extends Restaurant {
  pickLabel: string;
  pickEmoji: string;
  pickGradient: string;
}

const LABELS = [
  { pickLabel: 'Hidden gem', pickEmoji: '', pickGradient: 'from-fooder-primary to-bubblegum' },
  { pickLabel: 'Le crush du jour', pickEmoji: '', pickGradient: 'from-fooder-orange to-fooder-red' },
  { pickLabel: 'Spot secret', pickEmoji: '', pickGradient: 'from-fooder-mint to-fooder-primary' },
];

export function useDailyPicks(restaurants: Restaurant[]) {
  const [picks, setPicks] = useState<DailyPick[]>([]);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (restaurants.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : null;

    let ids: string[];
    if (stored?.date === today && Array.isArray(stored.ids)) {
      ids = stored.ids;
    } else {
      const dateSeed = today.replace(/-/g, '');
      const n = parseInt(dateSeed.slice(-4), 10);
      const shuffled = [...restaurants].sort((a, b) =>
        ((n * a.id.charCodeAt(0)) % 97) - ((n * b.id.charCodeAt(0)) % 97)
      );
      ids = shuffled.slice(0, Math.min(3, shuffled.length)).map(r => r.id);
      localStorage.setItem(KEY, JSON.stringify({ date: today, ids }));
    }

    setPicks(
      ids.map((id, i) => {
        const r = restaurants.find(x => x.id === id) || restaurants[i % restaurants.length];
        return { ...r, ...LABELS[i % LABELS.length] };
      })
    );
  }, [restaurants]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const ms = midnight.getTime() - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${h}h${String(m).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return { picks, countdown };
}
