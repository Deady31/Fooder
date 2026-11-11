'use client';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'fooder_daily_swipes';
const PREMIUM_KEY = 'fooder_premium';

interface SwipeRecord {
  count: number;
  date: string;
}

export function useFreemium() {
  const [swipeCount, setSwipeCount] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: SwipeRecord | null = raw ? JSON.parse(raw) : null;
    const count = stored?.date === today ? stored.count : 0;
    if (!stored || stored.date !== today) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 0, date: today }));
    }
    setSwipeCount(count);
    setIsPremium(localStorage.getItem(PREMIUM_KEY) === '1');
    setLoaded(true);
  }, []);

  const activatePremium = useCallback(() => {
    localStorage.setItem(PREMIUM_KEY, '1');
    setIsPremium(true);
    setShowPremiumModal(false);
  }, []);

  const deactivatePremium = useCallback(() => {
    localStorage.removeItem(PREMIUM_KEY);
    setIsPremium(false);
  }, []);

  const trySwipe = useCallback((): boolean => {
    const newCount = swipeCount + 1;
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, date: today }));
    setSwipeCount(newCount);
    return true;
  }, [swipeCount]);

  return {
    swipeCount,
    canSwipe: true,
    isPremium,
    activatePremium,
    deactivatePremium,
    showPremiumModal,
    setShowPremiumModal,
    trySwipe,
    loaded,
  };
}
