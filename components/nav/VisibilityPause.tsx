'use client';
import { useEffect } from 'react';
import { applyHidden } from '../../lib/shell';

/** Pose `data-hidden` sur <html> quand l'onglet est masqué : les animations infinies se mettent en pause (règle dans globals.css). */
export function VisibilityPause() {
  useEffect(() => {
    const sync = () => applyHidden(document.documentElement, document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      applyHidden(document.documentElement, false);
    };
  }, []);
  return null;
}
