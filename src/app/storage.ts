import { createStore, del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

// Speicher: IndexedDB (idb-keyval). Ältere Versionen haben localStorage genutzt;
// diese Daten werden beim ersten Lesen übernommen und nach dem ersten Schreiben in
// IndexedDB aus localStorage entfernt.
//
// Beispielmodus: Solange er aktiv ist, wird nichts geschrieben. So überschreibt ein
// Beispiel nie die echten Daten.

let idbStore: ReturnType<typeof createStore> | null = null;
function db() {
  idbStore ??= createStore('weniger', 'daten');
  return idbStore;
}

let demo = false;
export function setStorageDemo(v: boolean) {
  demo = v;
}
export function isStorageDemo() {
  return demo;
}

type ErrorListener = (failed: boolean) => void;
const listeners = new Set<ErrorListener>();
export function onSaveError(fn: ErrorListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function report(failed: boolean) {
  for (const fn of listeners) fn(failed);
}

function lsGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export const appStorage: StateStorage = {
  async getItem(name) {
    try {
      const v = await get<string>(name, db());
      if (typeof v === 'string') return v;
    } catch {
      /* IndexedDB nicht verfügbar: weiter mit localStorage */
    }
    return lsGet(name);
  },
  async setItem(name, value) {
    if (demo) return;
    try {
      await set(name, value, db());
      report(false);
      try {
        localStorage.removeItem(name);
      } catch {
        /* egal */
      }
      return;
    } catch {
      /* unten: localStorage als Notlösung */
    }
    try {
      localStorage.setItem(name, value);
      report(false);
    } catch {
      report(true);
    }
  },
  async removeItem(name) {
    if (demo) return;
    try {
      await del(name, db());
    } catch {
      /* egal */
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* egal */
    }
  },
};

/** Bittet den Browser, die Daten nicht bei Platzmangel zu löschen. Einmal pro Start reicht. */
let asked = false;
export async function requestPersistence(): Promise<boolean> {
  if (asked) return false;
  asked = true;
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
