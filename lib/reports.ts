import { STORE_EVENT, readJson, writeJson } from './store';
import { track } from './analytics';

/** Signalements de l'utilisateur : une fiche signalée disparaît de SON appli (paquet et carte). */
export const REPORTS_KEY = 'fooder_reports';

export type ReportReason = 'closed' | 'not_restaurant';

export const REPORT_LABEL: Record<ReportReason, string> = {
  closed: 'Ce resto est fermé',
  not_restaurant: 'Ce n’est pas un resto',
};

export function readReported(): Set<string> {
  const raw = readJson<unknown>(REPORTS_KEY, []);
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
}

export function reportPlace(id: string, reason: ReportReason): void {
  const ids = readReported();
  ids.add(id);
  writeJson(REPORTS_KEY, Array.from(ids));
  track('report_place', { place_id: id, reason });
}

/** Rappelle `cb` quand la liste change (cet onglet ou un autre). */
export function subscribeReports(cb: () => void): () => void {
  const onStore = (e: Event) => { if ((e as CustomEvent).detail === REPORTS_KEY) cb(); };
  const onStorage = (e: StorageEvent) => { if (e.key === REPORTS_KEY) cb(); };
  window.addEventListener(STORE_EVENT, onStore);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(STORE_EVENT, onStore);
    window.removeEventListener('storage', onStorage);
  };
}
