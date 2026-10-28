// Messung nur auf der Landingpage, ohne Cookies, standardmässig aus.
// Einschalten in .env (siehe .env.example):
//   VITE_ANALYTICS=umami      VITE_ANALYTICS_SRC=https://…/script.js   VITE_ANALYTICS_ID=<website-id>
//   VITE_ANALYTICS=plausible  VITE_ANALYTICS_SRC=https://plausible.io/js/script.js   VITE_ANALYTICS_ID=<domain>
// Gemessen: Seitenaufrufe (vom Skript), «Rechner benutzt», «Starten geklickt», Quelle aus ?ref=.
// In der App selbst wird nie gemessen.

type Props = Record<string, string>;
type W = Window & {
  umami?: { track: (name: string, data?: Props) => void };
  plausible?: ((name: string, opts?: { props?: Props }) => void) & { q?: unknown[] };
};

const kind = (import.meta.env.VITE_ANALYTICS ?? '').trim();
const src = (import.meta.env.VITE_ANALYTICS_SRC ?? '').trim();
const id = (import.meta.env.VITE_ANALYTICS_ID ?? '').trim();
const enabled = (kind === 'umami' || kind === 'plausible') && /^https:\/\//.test(src) && id !== '';

export function initAnalytics() {
  if (!enabled) return;
  const w = window as W;
  if (kind === 'plausible') {
    // Warteschlange, damit frühe Ereignisse nicht verloren gehen
    w.plausible = w.plausible ?? Object.assign((...args: unknown[]) => (w.plausible!.q = w.plausible!.q ?? []).push(args), {});
  }
  const s = document.createElement('script');
  s.defer = true;
  s.src = src;
  s.setAttribute(kind === 'umami' ? 'data-website-id' : 'data-domain', id);
  document.head.appendChild(s);
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[\w-]{1,40}$/.test(ref)) {
    // Kurz warten, bis das Skript da ist
    s.addEventListener('load', () => track('Quelle', { ref }));
  }
}

export function track(name: string, props?: Props) {
  if (!enabled) return;
  const w = window as W;
  try {
    if (kind === 'umami') w.umami?.track(name, props);
    else w.plausible?.(name, props ? { props } : undefined);
  } catch {
    /* Messung ist nie wichtiger als die Seite */
  }
}
