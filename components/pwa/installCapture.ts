/** Capture précoce de `beforeinstallprompt` (l'événement n'est émis qu'une fois) pour l'utiliser plus tard. */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallCapture {
  start: () => void;
  get: () => BeforeInstallPromptEvent | null;
  clear: () => void;
  subscribe: (cb: () => void) => () => void;
}

export function createInstallCapture(target: Pick<EventTarget, 'addEventListener'>): InstallCapture {
  let captured: BeforeInstallPromptEvent | null = null;
  let started = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(cb => cb());

  return {
    start() {
      if (started) return;
      started = true;
      target.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        captured = e as BeforeInstallPromptEvent;
        notify();
      });
      target.addEventListener('appinstalled', () => {
        captured = null;
        notify();
      });
    },
    get: () => captured,
    clear() {
      captured = null;
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

let shared: InstallCapture | null = null;

/** Instance liée à `window` (navigateur uniquement) ; `start()` est idempotent. */
export function installCapture(): InstallCapture {
  shared ??= createInstallCapture(window);
  return shared;
}
