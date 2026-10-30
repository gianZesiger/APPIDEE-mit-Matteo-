import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motionOK } from './fx-level';

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Nach oben scrollen. Im Handy-Rahmen (Desktop) scrollt nicht das Fenster, sondern .app-scroll. */
export function scrollToTop() {
  const inner = document.querySelector<HTMLElement>('.app-scroll');
  if (inner) inner.scrollTop = 0;
  else window.scrollTo({ top: 0 });
}

/** Datei herunterladen, ohne Server. */
export function downloadFile(name: string, content: string | Blob, type = 'text/plain') {
  try {
    const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export function Ring({
  size = 260,
  stroke = 16,
  progress,
  tone = '',
  marks = [],
  label,
  valueText,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  tone?: '' | 'moss' | 'calm' | 'gold';
  marks?: number[];
  /** Name des Fortschritts für Screenreader, z.B. «Bis zum nächsten Meilenstein» */
  label?: string;
  /** Wert als Text, z.B. «Noch 3 Tage bis 7 Tage» */
  valueText?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const [shown, setShown] = useState(0);
  const gid = `rg-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(p));
    return () => cancelAnimationFrame(id);
  }, [p]);
  return (
    <div className="ring-wrap" style={{ width: size, height: size, maxWidth: '100%' }}>
      <div className={`ring-glow ${tone}`} aria-hidden="true" />
      {/* Die Fortschritts-Rolle sitzt auf der Grafik, nicht auf dem Rahmen: im Ring stehen Knöpfe */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ maxWidth: '100%', height: 'auto' }}
        focusable="false"
        {...(label
          ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(p * 100), 'aria-valuetext': valueText }
          : { 'aria-hidden': true })}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className={`rg-a ${tone}`} />
            <stop offset="100%" className={`rg-b ${tone}`} />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`ring-bar ${tone}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          // Farbe per style: schlägt jede CSS-Regel, der Verlauf ist immer sichtbar
          style={{ stroke: `url(#${gid})` }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <g className="ring-tip-g" style={{ transform: `rotate(${shown * 360}deg)`, transformOrigin: '50% 50%' }}>
          <circle className={`ring-tip ${tone}`} cx={size / 2} cy={stroke / 2} r={stroke * 0.62} />
          <circle cx={size / 2} cy={stroke / 2} r={stroke * 0.26} fill="var(--surface-solid)" />
        </g>
        {marks.map((m) => {
          const a = m * 2 * Math.PI - Math.PI / 2;
          const x = size / 2 + r * Math.cos(a);
          const y = size / 2 + r * Math.sin(a);
          return <circle key={m} cx={x} cy={y} r={stroke / 5} fill="var(--surface)" />;
        })}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function CountUp({ value, format, duration = 600 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!motionOK()) {
      setV(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(v)}</>;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, select, a[href], [tabindex]:not([tabindex="-1"])';

export function Sheet({ onClose, children, label, quiet }: { onClose: () => void; children: ReactNode; label: string; quiet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (f.length === 0) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  // Als Portal an die App: sonst fängt ein Eltern-Element mit transform (Tilt) das fixe Sheet ein
  const host = typeof document !== 'undefined' ? (document.querySelector('.app') ?? document.body) : null;
  const sheet = (
    <div className="sheet-back" onClick={onClose}>
      <div ref={ref} className={`sheet ${quiet ? 'quiet' : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
  return host ? createPortal(sheet, host) : sheet;
}

/** Kurze Meldung unten. Mit Aktion (z.B. «Rückgängig») bleibt sie etwas länger stehen. */
export function Toast({ text, onDone, action }: { text: string; onDone: () => void; action?: { label: string; onClick: () => void } }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), action ? 5000 : 2800);
    return () => clearTimeout(t);
  }, [text, action]);
  return (
    <div className={`toast ${action ? 'with-action' : ''}`} role="status">
      <span>{text}</span>
      {action && (
        <button
          className="toast-action"
          onClick={() => {
            action.onClick();
            done.current();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export const Icon = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
  ),
  group: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="9" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M3 19c.6-3 2.7-4.5 5-4.5s4.4 1.5 5 4.5M14 15c2.3-.3 4.4.8 5.5 4" /></svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><path d="M16.5 13.5v6M13.5 16.5h6" /></svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1-3.8 3.7-5.5 7-5.5s6 1.7 7 5.5" /></svg>
  ),
};
