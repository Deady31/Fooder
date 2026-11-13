'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { STORE_EVENT } from '../lib/store';
import { MISSIONS_KEY, Mission, MissionState, progressMission, readMissionState } from '../lib/missions';

export type { Mission };

/**
 * Missions du jour. `progress` calcule et écrit HORS de tout updater setState (aucun effet de bord pendant le rendu),
 * renvoie la mission qui vient d'être terminée, verse son XP une seule fois par jour et émet l'événement `mission`.
 * Plusieurs instances (page Découvrir, MissionsChip) restent synchronisées via STORE_EVENT.
 */
export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const stateRef = useRef<MissionState | null>(null);

  useEffect(() => {
    const load = () => {
      const s = readMissionState(Date.now(), stateRef.current);
      stateRef.current = s;
      setMissions(s.missions);
    };
    load();
    const onStore = (e: Event) => {
      if ((e as CustomEvent<string>).detail === MISSIONS_KEY) load();
    };
    window.addEventListener(STORE_EVENT, onStore);
    return () => window.removeEventListener(STORE_EVENT, onStore);
  }, []);

  const progress = useCallback((id: string, amount = 1): Mission | null => {
    const { state, completed } = progressMission(id, amount, { fallback: stateRef.current });
    stateRef.current = state;
    setMissions(state.missions);
    return completed;
  }, []);

  const completedCount = missions.filter(m => m.completed).length;

  return { missions, progress, completedCount, total: missions.length };
}
