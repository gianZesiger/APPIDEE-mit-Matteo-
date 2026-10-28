// Effektstufen für App und Landingpage: html[data-fx=hoch|mittel|tief].
// Ohne Store und ohne React, damit die Landingpage es auch klein nutzen kann.
//   hoch:   Lichtspiel bewegt, Dauerschleifen, Tilt, alle Funken
//   mittel: Lichtspiel steht still, kurze Übergänge, halbe Funken, keine Dauerschleifen
//   tief:   keine Bewegung, kein Lichtspiel, keine Unschärfe
// Die Wahl im Profil hat Vorrang. Sonst entscheiden Systemeinstellung, Datensparen,
// Prozessorkerne, Arbeitsspeicher und eine 2-Sekunden-Messung der Bildrate.

export type FxLevel = 'hoch' | 'mittel' | 'tief';
export type FxChoice = 'auto' | FxLevel;
export const FX_CHOICES: FxChoice[] = ['auto', 'hoch', 'mittel', 'tief'];

export interface DeviceHints {
  reduced: boolean;
  saveData: boolean;
  cores?: number;
  memory?: number;
}

const ORDER: FxLevel[] = ['tief', 'mittel', 'hoch'];
const lower = (l: FxLevel): FxLevel => ORDER[Math.max(0, ORDER.indexOf(l) - 1)];
const min = (a: FxLevel, b: FxLevel): FxLevel => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

/** Stufe aus den Geräte-Hinweisen. Unbekannte Werte (z. B. Safari ohne deviceMemory) zählen nicht. */
export function levelFromHints(h: DeviceHints): FxLevel {
  if (h.reduced || h.saveData) return 'tief';
  const cores = h.cores ?? 8;
  const memory = h.memory ?? 8;
  if (cores <= 2 || memory <= 1) return 'tief';
  if (cores < 4 || memory < 4) return 'mittel';
  return 'hoch';
}

/** Nach der Messung: unter 25 Bildern pro Sekunde tief, unter 45 eine Stufe tiefer. */
export function levelAfterFps(level: FxLevel, fps: number): FxLevel {
  if (fps < 25) return 'tief';
  if (fps < 45) return lower(level);
  return level;
}

export function resolveLevel(choice: FxChoice, auto: FxLevel, cap: FxLevel = 'hoch'): FxLevel {
  return choice === 'auto' ? min(auto, cap) : choice;
}

export function isChoice(v: unknown): v is FxChoice {
  return typeof v === 'string' && (FX_CHOICES as string[]).includes(v);
}

// ---------- Laufzeit ----------

// Spiegel der Profil-Wahl, damit die Stufe schon vor dem Laden der Daten stimmt (nur Darstellung, keine Nutzerdaten)
const KEY = 'weniger-fx';
const MEASURED = 'weniger-fx-fps';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
export const IDLE_MS = 20_000;

function read(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(store: 'local' | 'session', key: string, v: string) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, v);
  } catch {
    /* privates Fenster: dann eben ohne Spiegel */
  }
}

function hints(): DeviceHints {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let reduced = false;
  try {
    reduced = matchMedia(REDUCE_QUERY).matches;
  } catch {
    /* kein matchMedia */
  }
  return { reduced, saveData: !!nav.connection?.saveData, cores: nav.hardwareConcurrency || undefined, memory: nav.deviceMemory };
}

const stored = read('local', KEY);
let choice: FxChoice = isChoice(stored) ? stored : 'auto';
let auto: FxLevel = 'hoch';
let cap: FxLevel = 'hoch';
let idle = false;
const listeners = new Set<() => void>();

function computeAuto() {
  auto = levelFromHints(hints());
  const fps = Number(read('session', MEASURED));
  if (fps > 0) auto = levelAfterFps(auto, fps);
}
computeAuto();

export const fxLevel = (): FxLevel => resolveLevel(choice, auto, cap);
export const fxChoice = (): FxChoice => choice;
/** Die Stufe, die «Automatisch» auf diesem Gerät ergibt. */
export const fxAuto = (): FxLevel => min(auto, cap);
/** Bewegung erlaubt (mittel und hoch). */
export const motionOK = (): boolean => fxLevel() !== 'tief';
/** Volle Effekte: Dauerschleifen, Tilt, bewegtes Lichtspiel. */
export const richFx = (): boolean => fxLevel() === 'hoch';
export const isIdle = (): boolean => idle;

export function subscribeFx(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply() {
  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    html.dataset.fx = fxLevel();
    html.toggleAttribute('data-idle', idle);
  }
  listeners.forEach((l) => l());
}

export function setFxChoice(c: FxChoice) {
  if (c === choice) return;
  choice = c;
  write('local', KEY, c);
  apply();
}

/** Obergrenze, z. B. für die App im Handy-Rahmen der Landingpage. */
export function capFx(l: FxLevel) {
  cap = l;
  apply();
}

/** Zählt 2 Sekunden lang die Bilder. Ergibt 0, wenn die Seite dabei im Hintergrund war. */
export function measureFps(ms = 2000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined' || document.hidden) return resolve(0);
    let frames = 0;
    let start = 0;
    let hidden = false;
    const onVis = () => (hidden ||= document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const step = (t: number) => {
      if (!start) start = t;
      else frames++;
      if (t - start < ms) requestAnimationFrame(step);
      else {
        document.removeEventListener('visibilitychange', onVis);
        resolve(hidden ? 0 : (frames * 1000) / (t - start));
      }
    };
    requestAnimationFrame(step);
  });
}

/** Meldet Ruhe nach `ms` ohne Eingabe und wieder Aktivität bei der nächsten Eingabe. */
export function watchIdle(onChange: (idle: boolean) => void, ms = IDLE_MS, target: EventTarget = window): () => void {
  let timer: ReturnType<typeof setTimeout>;
  let now = false;
  const arm = () => {
    clearTimeout(timer);
    if (now) onChange((now = false));
    timer = setTimeout(() => onChange((now = true)), ms);
  };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'];
  events.forEach((e) => target.addEventListener(e, arm, { passive: true, capture: true }));
  arm();
  return () => {
    clearTimeout(timer);
    events.forEach((e) => target.removeEventListener(e, arm, { capture: true }));
  };
}

let started = false;

/** Setzt data-fx, misst einmal pro Sitzung die Bildrate und pausiert Dauerschleifen nach 20 Sekunden Ruhe. */
export function initFx() {
  if (started || typeof window === 'undefined') return;
  started = true;
  apply();
  try {
    matchMedia(REDUCE_QUERY).addEventListener('change', () => (computeAuto(), apply()));
  } catch {
    /* kein matchMedia */
  }
  watchIdle((v) => {
    idle = v;
    apply();
  });
  if (read('session', MEASURED) || auto === 'tief') return;
  const run = () =>
    void measureFps().then((fps) => {
      if (!fps) return;
      write('session', MEASURED, String(Math.round(fps)));
      computeAuto();
      apply();
    });
  // Erst messen, wenn der Start vorbei ist, sonst zählt das Laden mit
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}
