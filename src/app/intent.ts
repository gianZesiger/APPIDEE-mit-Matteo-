// Kurzbefehle aus dem Manifest: /app/#checkin öffnet «Heute» beim Check-in, /app/#training den Trainingseintrag.
// Gilt beim Start und wenn die offene App nur den Hash wechselt (Kurzbefehl bei laufender App).
import { useEffect } from 'react';

export type Intent = 'checkin' | 'training';
export const INTENT_TAB: Record<Intent, 'heute' | 'sport'> = { checkin: 'heute', training: 'sport' };

let pending: Intent | null = null;
const listeners = new Set<() => void>();

function read() {
  try {
    const h = location.hash.slice(1);
    if (h in INTENT_TAB) {
      pending = h as Intent;
      listeners.forEach((l) => l());
    }
  } catch {
    /* ohne Adresse */
  }
}
read();
if (typeof window !== 'undefined') window.addEventListener('hashchange', read);

/** Führt `run` einmal aus, wenn der Kurzbefehl ansteht, und schreibt die Adresse auf den Tab um. */
export function useIntent(name: Intent, run: () => void) {
  useEffect(() => {
    const check = () => {
      if (pending !== name) return;
      pending = null;
      try {
        history.replaceState(null, '', `${location.pathname}${location.search}#${INTENT_TAB[name]}`);
      } catch {
        /* egal */
      }
      run();
    };
    check();
    listeners.add(check);
    return () => void listeners.delete(check);
    // run ändert sich bei jedem Rendern; entscheidend ist nur der Kurzbefehl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}
