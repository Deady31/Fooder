'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  AppNotification,
  NOTIF_EVENT,
  clearNotifications,
  markAllRead,
  pushNotification,
  readNotifications,
} from '../lib/notifications';

const WELCOME_KEY = 'fooder_notif_welcome';

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_KEY)) {
        localStorage.setItem(WELCOME_KEY, '1');
        pushNotification({
          id: 'welcome',
          kind: 'system',
          title: 'Bienvenue sur Fooder',
          body: 'Tes succès et les réactions du fil apparaîtront ici.',
        });
      }
    } catch {
      /* ignoré */
    }
    const sync = () => setItems(readNotifications());
    sync();
    window.addEventListener(NOTIF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(NOTIF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const unread = items.filter(n => !n.read).length;
  const readAll = useCallback(() => markAllRead(), []);
  const clear = useCallback(() => clearNotifications(), []);

  return { items, unread, readAll, clear };
}
