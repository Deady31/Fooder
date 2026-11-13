'use client';
import { useCallback, useEffect, useState } from 'react';
import { BoardResult, Period, RankResult, fetchLeaderboard, fetchMyRank } from '../../lib/cloud/leaderboard';

export interface LeaderboardState {
  loading: boolean;
  board: BoardResult | null;
  mine: RankResult | null;
  reload: () => void;
}

/** Charge le classement global et ma position pour une période. Les réponses d'une ancienne période sont ignorées. */
export function useLeaderboard(period: Period, enabled: boolean): LeaderboardState {
  const [loading, setLoading] = useState(enabled);
  const [board, setBoard] = useState<BoardResult | null>(null);
  const [mine, setMine] = useState<RankResult | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    setLoading(true);
    Promise.all([fetchLeaderboard(period), fetchMyRank(period)]).then(([b, m]) => {
      if (stale) return;
      setBoard(b);
      setMine(m);
      setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [period, enabled, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { loading, board, mine, reload };
}

/** Rang de la semaine de l'utilisateur connecté, pour les points d'entrée (profil). null si inconnu ou non classé. */
export function useWeekRank(enabled: boolean): number | null {
  const [rank, setRank] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    fetchMyRank('week').then(r => {
      if (!stale && r.status === 'ok') setRank(r.me.rank);
    });
    return () => {
      stale = true;
    };
  }, [enabled]);
  return rank;
}
