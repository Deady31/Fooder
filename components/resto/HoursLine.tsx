'use client';
import { useEffect, useState } from 'react';
import { parisWallClock } from '../../lib/openingHours';
import { hoursSummary } from '../../lib/restoShare';

/** Statut Ouvert/Fermé calculé dans le navigateur (heure de Paris), pour rester juste sur une page mise en cache. */
export function HoursLine({ hours }: { hours: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setText(hoursSummary(hours, parisWallClock(new Date())));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours]);

  return <span>{text ?? 'Horaires en cours de chargement'}</span>;
}
