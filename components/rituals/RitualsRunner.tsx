'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const run = () => {
      const now = new Date();
      const due = dueCheckins(readCheckins(), now.getTime());
      due.forEach(c =>
        pushNotification({
          id: `checkin-${c.restId}-${c.dueAt}`,
          kind: 'social',
          title: `Alors, ${c.name} ?`,
          body: 'Tu y es allé ? Donne ton verdict : +40 XP.',
          href: `/wishlist?checkin=${encodeURIComponent(c.restId)}`,
        })
      );

      const visits = readVisits();
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
      if (pathname === '/swipe' && due.length > 0) {
        try {
          if (sessionStorage.getItem(PROMPTED_KEY)) return;
          sessionStorage.setItem(PROMPTED_KEY, '1');
        } catch {
          return;
        }
        setTimeout(() => setPrompt(due[0]), 1400);
      }
    };

    run();
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [pathname]);

  return (
    <CheckinSheet
      target={prompt ? { restId: prompt.restId, name: prompt.name, cuisine: prompt.cuisine, lat: prompt.lat, lng: prompt.lng } : null}
      mode='ask'
      onClose={() => setPrompt(null)}
    />
  );
}
