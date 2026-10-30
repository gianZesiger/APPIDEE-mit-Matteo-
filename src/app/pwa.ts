// Service Worker (vite-plugin-pwa, Workbox) mit Update-Hinweis statt stillem Neuladen.
import { useSyncExternalStore } from 'react';

let reload: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Neue Version wartet: Funktion zum Neuladen, sonst null. */
export function useUpdate(): (() => void) | null {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => reload,
    () => null,
  );
}

/** Eine neue Version wartet; `apply` lädt sie. */
export function offerUpdate(apply: () => void) {
  reload = apply;
  emit();
}

export function dismissUpdate() {
  reload = null;
  emit();
}

// ---------- Installieren (Android, Chrome): das Ereignis merken, der Hinweis zeigt dann einen eigenen Knopf ----------

type InstallEvent = Event & { prompt: () => Promise<void> };
let installEvent: InstallEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    installListeners.forEach((l) => l());
  });
}

/** Kann der Browser die App mit einem eigenen Knopf installieren? */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const ev = useSyncExternalStore(
    (cb) => (installListeners.add(cb), () => installListeners.delete(cb)),
    () => installEvent,
    () => null,
  );
  return ev
    ? async () => {
        await ev.prompt();
        installEvent = null;
        installListeners.forEach((l) => l());
      }
    : null;
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Nur in der echten App: nicht im Entwicklungsmodus, nicht in der Einzeldatei, nicht im Rahmen der Landingpage. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || import.meta.env.VITE_SINGLEFILE || !('serviceWorker' in navigator) || window.top !== window) return;
  window.addEventListener('load', () => {
    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const update = registerSW({
          onNeedRefresh: () => offerUpdate(() => void update(true)),
        });
      })
      .catch(() => {
        /* ohne Offline-Modus weiter */
      });
  });
}
