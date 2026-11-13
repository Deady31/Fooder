'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Restaurant } from '../../data/mockRestaurants';
import { CheckinSheet } from '../checkin/CheckinSheet';
import { pushNotification } from '../../lib/notifications';
import { Checkin, dueCheckins, readCheckins, readVisits } from '../../lib/visits';
import { isWeekendWindow, weekendPicks } from '../../lib/rituals';
import { weekKey, weeklyStreak } from '../../lib/streak';
import { readJson } from '../../lib/store';

const PROMPTED_KEY = 'fooder_checkin_prompted';

/** Rappels qui créent l'habitude : « Tu y es allé ? », le vendredi Fooder, la série en jeu. */
export function RitualsRunner() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<Checkin | null>(null);
  /** Minuteur de la question spontanée : annulé au changement d'écran et au démontage (aucune fuite). */
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (promptTimer.current !== null) {
        clearTimeout(promptTimer.current);
        promptTimer.current = null;
      }
    };

    const run = () => {
      const now = new Date();
      const stored = readCheckins();
      const due = dueCheckins(Array.isArray(stored) ? stored : [], now.getTime());
      due.forEach(c =>
        pushNotification({
          id: `checkin-${c.restId}-${c.dueAt}`,
          kind: 'social',
          title: `Alors, ${c.name} ?`,
          body: 'Tu y es allé ? Donne ton verdict : +40 XP.',
          href: `/wishlist?checkin=${encodeURIComponent(c.restId)}`,
        })
      );

      const rawVisits = readVisits();
      const visits = Array.isArray(rawVisits) ? rawVisits : [];
      if (isWeekendWindow(now)) {
        const picks = weekendPicks(readJson<Restaurant[]>('fooder_likes', []), visits);
        if (picks.length > 0) {
          pushNotification({
            id: `weekend-${weekKey(now.getTime())}`,
            kind: 'system',
            title: 'Ton vendredi Fooder',
            body: `Ce week-end : ${picks.map(p => p.name).join(', ')}.`,
            href: '/wishlist',
          });
        }
        const streak = weeklyStreak(visits.map(v => v.at), now.getTime());
        if (streak.current > 0 && !streak.thisWeekDone && now.getDay() === 0) {
          pushNotification({
            id: `streak-risk-${weekKey(now.getTime())}`,
            kind: 'system',
            title: `Ta série de ${streak.current} semaine${streak.current > 1 ? 's' : ''} est en jeu`,
            body: 'Teste un resto avant ce soir pour la garder.',
            href: '/wishlist',
          });
        }
      }

      // Une seule question spontanée par session, et seulement sur l'écran Découvrir.
      // Le marqueur de session n'est posé qu'au déclenchement : une navigation avant 1,4 s n'« use » pas la question.
      if (pathname === '/swipe' && due.length > 0 && promptTimer.current === null) {
        try {
          if (sessionStorage.getItem(PROMPTED_KEY)) return;
        } catch {
          return;
        }
        const first = due[0];
        promptTimer.current = setTimeout(() => {
          promptTimer.current = null;
          try {
            if (sessionStorage.getItem(PROMPTED_KEY)) return;
            sessionStorage.setItem(PROMPTED_KEY, '1');
          } catch {
            return;
          }
          setPrompt(first);
        }, 1400);
      }
    };

    // Hors ligne ou stockage indisponible : un rituel qui échoue ne doit jamais faire tomber l'application.
    const safeRun = () => {
      try {
        run();
      } catch {
        /* rien à rappeler pour cette fois */
      }
    };

    safeRun();
    const onVisible = () => document.visibilityState === 'visible' && safeRun();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimer();
    };
  }, [pathname]);

  return (
    <CheckinSheet
      target={prompt ? { restId: prompt.restId, name: prompt.name, cuisine: prompt.cuisine, lat: prompt.lat, lng: prompt.lng } : null}
      mode='ask'
      onClose={() => setPrompt(null)}
    />
  );
}
