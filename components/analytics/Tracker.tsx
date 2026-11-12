'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getTracker, getUsageEnabled } from '../../lib/analytics';
import { isCloudEnabled } from '../../lib/cloud/client';
import { ensureCloudSession } from '../../lib/cloud/session';
import { HEARTBEAT_MS, cleanLabel, screenFromPath } from '../../lib/tracking';

/**
 * Suivi automatique (monté une fois dans components/Providers.tsx) :
 *  - screen_view à chaque changement de route ;
 *  - clic sur bouton / lien : libellé (aria-label ou texte nettoyé, 40 car.), écran, balise. Jamais le contenu d'un champ ;
 *  - battement de cœur toutes les 15 s, onglet visible seulement (temps actif) ;
 *  - session anonyme Supabase créée silencieusement au premier lancement (identifiant stable), échec silencieux.
 * Rien sur /admin. Rien si le cloud n'est pas configuré ou si le réglage « mesures d'usage » est désactivé.
 */

const CLICKABLE = 'button, a[href], [role="button"], [role="link"], [role="tab"], [role="switch"], [role="menuitem"], [role="checkbox"], [role="radio"]';
const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

const isAdminPath = (p: string | null): boolean => !!p && (p === '/admin' || p.startsWith('/admin/'));

function describeTarget(el: Element): Record<string, string> | null {
  if (el.closest('[data-no-track]') || el.closest(FIELD)) return null;
  const html = el as HTMLElement;
  const label = cleanLabel(html.dataset.trackLabel ?? el.getAttribute('aria-label') ?? el.getAttribute('title') ?? html.innerText ?? el.textContent);
  const out: Record<string, string> = { tag: el.tagName.toLowerCase(), label: label ?? '(sans libellé)' };
  if (el instanceof HTMLAnchorElement) {
    try {
      const url = new URL(el.href, window.location.href);
      out.target = url.origin === window.location.origin ? screenFromPath(url.pathname) : 'externe';
    } catch {
      /* lien invalide : pas de cible */
    }
  }
  return out;
}

export function Tracker() {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  // Session anonyme au premier lancement : les événements sont rattachés à un identifiant stable.
  useEffect(() => {
    if (admin || !isCloudEnabled() || !getUsageEnabled()) return;
    ensureCloudSession()
      .then(r => {
        if (r.ok) void getTracker()?.flush();
      })
      .catch(() => undefined);
  }, [admin]);

  // Écrans (une seule vue par changement de route, même si l'effet est rejoué)
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || admin || lastPath.current === pathname) return;
    if (getTracker()?.screenView(pathname)) lastPath.current = pathname;
  }, [pathname, admin]);

  // Clics, activité, battement de cœur, fin de session
  useEffect(() => {
    if (admin) return;
    const t = getTracker();
    if (!t) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
      if (!target) return;
      const props = describeTarget(target);
      if (props) t.track('click', props);
    };
    const onActivity = () => t.noteActivity();
    const beat = window.setInterval(() => t.heartbeat(document.visibilityState === 'visible'), HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        t.noteActivity();
        t.resetFailures();
      }
    };
    const onHide = () => {
      t.endSession('pagehide');
      void t.flush();
    };

    document.addEventListener('click', onClick, { capture: true, passive: true });
    for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const) window.addEventListener(ev, onActivity, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const) window.removeEventListener(ev, onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      window.clearInterval(beat);
    };
  }, [admin]);

  return null;
}
