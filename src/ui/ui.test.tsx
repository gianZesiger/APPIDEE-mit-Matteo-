// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Ring, Sheet, Toast } from './ui';
import { app } from '../i18n/de-CH';

describe('Bekannter Fehler: Ring-Bogen wird gezeichnet', () => {
  it('bei 80 % ist der Bogen sichtbar, mit eindeutigem Verlauf und Fortschritts-Rolle', async () => {
    render(
      <>
        <Ring progress={0.8} size={100} stroke={10} label="Test" valueText="80 Prozent" />
        <Ring progress={0.3} size={100} stroke={10} />
      </>,
    );
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const bars = document.querySelectorAll<SVGCircleElement>('.ring-bar');
    const ids = [...document.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    const bar = bars[0];
    expect(bar.style.stroke).toMatch(new RegExp(`^url\\("?#${ids[0]}"?\\)$`));
    const c = 2 * Math.PI * 45;
    expect(Number(bar.getAttribute('stroke-dashoffset'))).toBeCloseTo(c * 0.2, 3);
    const pb = screen.getByRole('progressbar', { name: 'Test' });
    expect(pb.getAttribute('aria-valuenow')).toBe('80');
    expect(pb.getAttribute('aria-valuetext')).toBe('80 Prozent');
  });
});

// jsdom kennt diese Browser-Funktionen nicht
beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.scrollTo = (() => {}) as never;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Bekannter Fehler 1: Toast verschwindet trotz Neu-Rendern jede Sekunde', () => {
  function Ticking() {
    const [, setN] = useState(0);
    const [toast, setToast] = useState<string | null>('Festgehalten.');
    useEffect(() => {
      const t = setInterval(() => setN((n) => n + 1), 200);
      return () => clearInterval(t);
    }, []);
    // onDone ist bei jedem Rendern eine neue Funktion, wie in «Heute»
    return toast ? <Toast text={toast} onDone={() => setToast(null)} /> : <p>leer</p>;
  }

  it('ist nach 2.8 s weg', () => {
    vi.useFakeTimers();
    render(<Ticking />);
    expect(screen.getByRole('status').textContent).toBe('Festgehalten.');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('leer')).toBeTruthy();
  });
});

describe('Bekannter Fehler 7: Sheets mit Startfokus, Fokusfalle und Fokus zurück', () => {
  function WithSheet() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Öffnen</button>
        {open && (
          <Sheet label="Test" onClose={() => setOpen(false)}>
            <button>Erster</button>
            <input aria-label="Feld" />
            <button>Letzter</button>
          </Sheet>
        )}
      </>
    );
  }

  it('fokussiert den ersten Knopf, hält den Fokus drin und gibt ihn zurück', () => {
    render(<WithSheet />);
    const opener = screen.getByText('Öffnen');
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement?.textContent).toBe('Erster');
    // Tab auf dem letzten Element springt zum ersten: dem sichtbaren Schliessen-Knopf
    screen.getByText('Letzter').focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Schliessen');
    // Shift+Tab auf dem ersten springt zum letzten
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.textContent).toBe('Letzter');
    // Escape schliesst, Fokus zurück auf den Öffnen-Knopf
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('Onboarding: «Los geht’s» immer aktiv, keine Checkbox, Start-Schritt wird gezeigt', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/app/');
  });

  it('ohne Auswahl ein Hinweis, mit Auswahl weiter bis «Heute»', async () => {
    const { default: App } = await import('../app/App');
    render(<App />);
    const go = await screen.findByRole('button', { name: app.onboarding.start });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(app.onboarding.adultNote)).toBeTruthy();
    fireEvent.click(go);
    expect(screen.getByRole('alert').textContent).toBe(app.onboarding.pickFirst);
    fireEvent.click(screen.getByRole('button', { name: /Mate/ }));
    expect(screen.getByRole('button', { name: /Mate/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(go);
    fireEvent.click(screen.getByRole('button', { name: app.common.next }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: app.onboarding.go }));
    expect(screen.getByText(app.onboarding.startedTitle)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(app.onboarding.startedTitle)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
    expect(await screen.findByText(app.heute.day1)).toBeTruthy();
    expect(screen.queryByText(app.onboarding.startedTitle)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
