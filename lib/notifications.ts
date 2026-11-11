export type NotificationKind = 'achievement' | 'feed' | 'system' | 'social';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Identifiant de succès (pour l'icône) quand kind === 'achievement' */
  ref?: string;
  /** Écran à ouvrir quand on touche la notification */
  href?: string;
  createdAt: number;
  read: boolean;
}

export const NOTIF_KEY = 'fooder_notifications';
export const NOTIF_EVENT = 'fooder:notifications';
const MAX_KEPT = 50;

export function readNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function write(list: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
    window.dispatchEvent(new Event(NOTIF_EVENT));
  } catch {
    /* stockage indisponible : on ignore */
  }
}

/** Ajoute une notification. Un même id n'est jamais ajouté deux fois. */
export function pushNotification(n: Omit<AppNotification, 'createdAt' | 'read'>): void {
  const list = readNotifications();
  if (list.some(x => x.id === n.id)) return;
  write([{ ...n, createdAt: Date.now(), read: false }, ...list]);
}

export function markAllRead(): void {
  const list = readNotifications();
  if (list.some(n => !n.read)) write(list.map(n => ({ ...n, read: true })));
}

export function clearNotifications(): void {
  write([]);
}
