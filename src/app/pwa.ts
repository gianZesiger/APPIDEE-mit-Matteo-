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
