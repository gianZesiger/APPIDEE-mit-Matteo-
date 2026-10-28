import { useSyncExternalStore } from 'react';
import { fxLevel, motionOK, subscribeFx, type FxLevel } from './fx-level';

export { motionOK, richFx } from './fx-level';

/** Aktuelle Effektstufe (hoch, mittel, tief). Reagiert auf Profil, Systemeinstellung und Messung. */
export function useFxLevel(): FxLevel {
  return useSyncExternalStore(subscribeFx, fxLevel, () => 'tief');
}

/** Bewegung erlaubt? */
export function useMotionOK(): boolean {
  return useFxLevel() !== 'tief';
}

type Fx = typeof import('../fx/effects');
let fxModule: Promise<Fx> | null = null;

/** Effekte werden erst bei Bedarf geladen, damit der Start klein bleibt. */
export function loadFx(): Promise<Fx> {
  fxModule ??= import('../fx/effects');
  return fxModule;
}

/** Goldene Funken, nur wenn Bewegung erlaubt ist. */
export function spark(x?: number, y?: number, opts?: { count?: number; colors?: string[] }) {
  if (!motionOK()) return;
  void loadFx().then((m) => m.sparkBurst(x, y, opts));
}
