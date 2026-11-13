'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readJson, writeJson } from '../store';
import {
  LAST_POSITION_KEY,
  MANUAL_POSITION_KEY,
  createPositionTracker,
  initialPosition,
  parseStoredManual,
  parseStoredPosition,
  roundCoords,
  toStoredPosition,
  type Coords,
  type PositionState,
  type PositionTracker,
} from './position';

/** Une position GPS de moins de 2 min, gardée en mémoire de session, évite une nouvelle demande au retour sur l'onglet. */
const SESSION_FRESH_MS = 2 * 60_000;
let session: PositionState | null = null;

export interface UsePosition {
  position: PositionState;
  /** Relance la géolocalisation (et abandonne une adresse saisie). */
  locate: () => void;
  /** Utilise une adresse saisie à la main. */
  setManual: (coords: Coords, label: string) => void;
}

function geolocation() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null;
}

/**
 * Position de l'utilisateur. N'attend rien : l'état initial (dernière position ou Capitole) est
 * disponible tout de suite, la position GPS précise arrive ensuite. Suivi arrêté au démontage.
 */
export function usePosition(): UsePosition {
  const [position, setPositionState] = useState<PositionState>(() => session ?? initialPosition(null, null));
  const tracker = useRef<PositionTracker | null>(null);

  const setPosition = useCallback((update: (prev: PositionState) => PositionState) => {
    setPositionState(prev => {
      const next = update(prev);
      session = next;
      return next;
    });
  }, []);

  const locate = useCallback(() => {
    tracker.current?.stop();
    try {
      localStorage.removeItem(MANUAL_POSITION_KEY);
    } catch {
      /* stockage indisponible */
    }
    setPosition(prev => (prev.source === 'manual' ? { ...initialPosition(parseStoredPosition(readJson<unknown>(LAST_POSITION_KEY, null), Date.now()), null), status: 'asking' } : { ...prev, status: 'asking' }));
    const t = createPositionTracker(geolocation(), {
      onFix: fix => {
        writeJson(LAST_POSITION_KEY, toStoredPosition(fix.coords, fix.accuracy, fix.at));
        setPosition(() => ({ coords: fix.coords, accuracy: fix.accuracy, status: 'granted', source: 'gps', updatedAt: fix.at, label: null }));
      },
      onError: status => setPosition(prev => (prev.source === 'gps' ? prev : { ...prev, status })),
    });
    tracker.current = t;
    t.start();
  }, [setPosition]);

  const setManual = useCallback((coords: Coords, label: string) => {
    tracker.current?.stop();
    writeJson(MANUAL_POSITION_KEY, { ...roundCoords(coords, 4), label });
    setPosition(() => ({ coords, accuracy: null, status: 'idle', source: 'manual', updatedAt: null, label }));
  }, [setPosition]);

  useEffect(() => {
    const fresh = session && session.source === 'gps' && session.updatedAt !== null && Date.now() - session.updatedAt < SESSION_FRESH_MS;
    if (session?.source === 'manual' || fresh) return () => tracker.current?.stop();
    const manual = parseStoredManual(readJson<unknown>(MANUAL_POSITION_KEY, null));
    const last = parseStoredPosition(readJson<unknown>(LAST_POSITION_KEY, null), Date.now());
    const start = initialPosition(last, manual);
    setPosition(() => start);
    if (!manual) locate();
    return () => tracker.current?.stop();
    // Une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { position, locate, setManual };
}
