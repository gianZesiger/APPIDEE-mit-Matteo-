import type React from 'react';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useHydrated, useStore } from './store';
import { Icon, scrollToTop } from '../ui/ui';
import { loadFx, motionOK } from '../ui/motion';
import { setFxChoice } from '../ui/fx-level';
import { INTENT_TAB, type Intent } from './intent';
import { UpdateBar } from './UpdateBar';
import { app as t } from '../i18n/de-CH';
import { parseChallenge } from '../domain/insights';
import { TEMPLATES } from '../domain/templates';

export type ChallengeEntry = { templateKey: string; days: number };

// Jeder Tab ist ein eigenes Stück Code und wird erst beim ersten Öffnen geladen
const loadHeute = () => import('../features/heute/Heute');
const loadSport = () => import('../features/sport/Sport');
const loadZiele = () => import('../features/ziele/Ziele');
const loadProfil = () => import('../features/profil/Profil');
const Heute = lazy(loadHeute);
const Sport = lazy(loadSport);
const Ziele = lazy(loadZiele);
const Profil = lazy(loadProfil);
const Onboarding = lazy(() => import('../features/onboarding/Onboarding'));
const Caustics = lazy(() => import('../fx/caustics'));
const DesktopAside = lazy(() => import('../features/desktop/Desktop'));

export type Tab = 'heute' | 'sport' | 'ziele' | 'profil';

const sportIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="14.5" cy="4.5" r="2" />
    <path d="M7 21l3-6 3 2v5M10 15l1.5-5.5L15 11l3 1M8 10l3.5-1.5" />
  </svg>
);

const TABS: { key: Tab; label: string; icon: React.ReactElement }[] = [
  { key: 'heute', label: t.nav.heute, icon: Icon.today },
  { key: 'sport', label: t.nav.sport, icon: sportIcon },
  { key: 'ziele', label: t.nav.ziele, icon: Icon.goals },
  { key: 'profil', label: t.nav.profil, icon: Icon.profile },
];

function readHash(): Tab {
  try {
    const raw = window.location.hash.replace('#', '');
    const h = (raw in INTENT_TAB ? INTENT_TAB[raw as Intent] : raw) as Tab;
    return TABS.some((x) => x.key === h) ? h : 'heute';
  } catch {
    return 'heute';
  }
}

/** Challenge-Link #c=mate-14: einmal lesen und aus der Adresse entfernen. */
function readChallenge(): ChallengeEntry | null {
  try {
    const c = parseChallenge(location.hash, TEMPLATES.map((x) => x.key));
    if (location.hash.startsWith('#c=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
    return c;
  } catch {
    return null;
  }
}

/** Einstieg über die Adresse: ?modus=beispiel oder #beispiel. ?modus=neu öffnet nur das Onboarding, wenn noch nichts da ist. */
function readEntry(): 'beispiel' | 'neu' | null {
  try {
    const params = new URLSearchParams(location.search);
    const m = params.get('modus');
    // Als Vorschau im Handy-Rahmen der Landingpage: ohne Beispiel-Banner
    if (params.get('rahmen') === '1' && window.top !== window) document.documentElement.dataset.rahmen = '1';
    const anchor = location.hash === '#beispiel';
    if (params.has('modus')) params.delete('modus');
    if (m || anchor) {
      const rest = params.toString();
      history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${anchor ? '#heute' : location.hash}`);
    }
    if (m === 'beispiel' || anchor) return 'beispiel';
    if (m === 'neu') return 'neu';
  } catch {
    /* ohne Parameter weiter */
  }
  return null;
}

const DESKTOP_QUERY = '(min-width: 900px)';
function subscribeDesktop(cb: () => void) {
  try {
    const mq = matchMedia(DESKTOP_QUERY);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  } catch {
    return () => {};
  }
}
const isDesktop = () => {
  try {
    return matchMedia(DESKTOP_QUERY).matches;
  } catch {
    return false;
  }
};

type ViewTransition = { finished: Promise<unknown>; ready?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };

export default function App() {
  const hydrated = useHydrated();
  const goals = useStore((s) => s.goals);
  const fxChoice = useStore((s) => s.fxLevel);
  const demo = useStore((s) => s.demo);
  const saveError = useStore((s) => s.saveError);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [tab, setTab] = useState<Tab>(readHash);
  // Erst entscheiden, wenn die gespeicherten Daten geladen sind. Nie Daten löschen oder überschreiben.
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeEntry | null>(null);
  const transition = useRef<Promise<unknown> | null>(null);
  const view = onboarding || adding ? 'ob' : tab;

  useEffect(() => {
    if (!hydrated || onboarding !== null) return;
    const ch = readChallenge();
    const entry = readEntry();
    if (ch) {
      // Challenge von einem Freund: neue Gewohnheit mit vorgewählter Vorlage, eigene Daten bleiben
      setChallenge(ch);
      const empty = useStore.getState().goals.length === 0;
      setAdding(!empty);
      setOnboarding(empty);
    } else if (entry === 'beispiel') {
      useStore.getState().enterDemo();
      setOnboarding(false);
    } else {
      setOnboarding(useStore.getState().goals.length === 0);
    }
  }, [hydrated, onboarding]);

  useEffect(() => {
    const on = () => setTab(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    if (hydrated && onboarding === false && goals.length === 0) setOnboarding(true);
  }, [hydrated, onboarding, goals.length]);

  // Die Wahl im Profil hat Vorrang (erst nach dem Laden, sonst gewinnt kurz der Standardwert)
  useEffect(() => {
    if (hydrated) setFxChoice(fxChoice);
  }, [hydrated, fxChoice]);

  // Effekte und die übrigen Tabs erst nachladen, wenn die App steht
  useEffect(() => {
    if (onboarding === null) return;
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 400));
    idle(() => {
      void loadFx().then((m) => m.installInteractions());
      if (!onboarding) [loadHeute, loadSport, loadZiele, loadProfil].forEach((l) => void l().catch(() => {}));
    });
  }, [onboarding]);

  useEffect(() => {
    if (!motionOK()) return;
    // Kurz warten, bis der Tab (lazy) gerendert ist
    const id = setTimeout(() => void loadFx().then((m) => (m.stagger(), m.reveal())), 30);
    return () => clearTimeout(id);
  }, [view]);

  function go(next: Tab) {
    const apply = () => {
      setTab(next);
      try {
        history.replaceState(null, '', `#${next}`);
      } catch {
        /* in eingebetteten Ansichten egal */
      }
      scrollToTop();
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition };
    // Nur ein Übergang gleichzeitig; während einer läuft, wird direkt gewechselt
    if (doc.startViewTransition && motionOK() && next !== tab && !transition.current) {
      try {
        const vt = doc.startViewTransition(() => flushSync(apply));
        vt.ready?.catch(() => {});
        vt.updateCallbackDone?.catch(() => {});
        transition.current = vt.finished.catch(() => {}).finally(() => {
          transition.current = null;
        });
        return;
      } catch {
        /* Fallback unten */
      }
    }
    apply();
  }

  const bg = (
    <Suspense fallback={null}>
      <Caustics />
    </Suspense>
  );

  let content: React.ReactNode;
  if (!hydrated || onboarding === null) {
    content = null;
  } else if (onboarding || adding) {
    content = (
      <main>
        <Suspense fallback={<div className="screen" aria-busy="true" />}>
          <Onboarding
            first={!adding}
            challenge={challenge}
            onCancel={() => {
              setAdding(false);
              setChallenge(null);
            }}
            onDone={() => {
              setOnboarding(false);
              setAdding(false);
              setChallenge(null);
              go('heute');
            }}
          />
        </Suspense>
      </main>
    );
  } else {
    content = (
      <>
        {demo && <DemoBanner />}
        {saveError && !demo && (
          <p className="banner warn" role="alert">
            {t.banner.saveError}
          </p>
        )}
        <main>
          <Suspense fallback={<div className="screen" aria-busy="true" />}>
            {tab === 'heute' && <Heute go={go} />}
            {tab === 'sport' && <Sport />}
            {tab === 'ziele' && <Ziele goNew={() => setAdding(true)} goToday={() => go('heute')} />}
            {tab === 'profil' && <Profil />}
          </Suspense>
        </main>
        <Nav tab={tab} go={go} />
      </>
    );
  }

  if (desktop) {
    // Breite Bildschirme: links Erklärung und QR-Code, rechts die App im Handy-Rahmen
    return (
      <>
        {bg}
        <div className="desk">
          <Suspense fallback={<aside className="desk-aside" />}>
            <DesktopAside />
          </Suspense>
          <div className="phone">
            <div className="app-scroll">
              <div className="app">
                {content}
                <UpdateBar />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {bg}
      <div className="app">
        {content}
        <UpdateBar />
      </div>
    </>
  );
}

/** Steht im Beispiel auf allen Tabs. Zurück zu den eigenen Daten oder zum Onboarding. */
function DemoBanner() {
  const exitDemo = useStore((s) => s.exitDemo);
  return (
    <div className="banner demo" role="status">
      <span>{t.banner.demo}</span>
      <button className="btn sm primary" onClick={() => void exitDemo()}>
        {t.banner.demoAction}
      </button>
    </div>
  );
}

function Nav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = inner.current?.querySelector<HTMLElement>(`a[data-tab="${tab}"]`);
      if (el && inner.current) {
        const r = el.getBoundingClientRect();
        const p = inner.current.getBoundingClientRect();
        setBlob({ x: r.left - p.left + 10, w: r.width - 20 });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab]);
  return (
    <nav className="nav" aria-label={t.nav.label}>
      <div className="nav-inner" ref={inner}>
        {blob && <span className="nav-blob" style={{ transform: `translateX(${blob.x}px)`, width: blob.w }} aria-hidden="true" />}
        {TABS.map((x) => (
          <a
            key={x.key}
            data-tab={x.key}
            href={`#${x.key}`}
            className={tab === x.key ? 'on' : ''}
            aria-current={tab === x.key ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go(x.key);
            }}
          >
            {x.icon}
            {x.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
