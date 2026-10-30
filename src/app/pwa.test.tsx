// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UpdateBar } from './UpdateBar';
import { dismissUpdate, offerUpdate } from './pwa';
import { pwa } from '../i18n/de-CH';
import { csp, headerRules, headersFile, matches } from '../landing/hosting';

afterEach(() => {
  act(() => dismissUpdate());
  cleanup();
});

describe('Update-Hinweis der installierten App', () => {
  it('erscheint erst, wenn eine neue Version wartet, und lädt nur auf Wunsch', () => {
    render(<UpdateBar />);
    expect(screen.queryByText(pwa.update.text)).toBeNull();
    const apply = vi.fn();
    act(() => offerUpdate(apply));
    expect(screen.getByRole('status').textContent).toContain('Neue Version da. Neu laden?');
    fireEvent.click(screen.getByRole('button', { name: pwa.update.reload }));
    expect(apply).toHaveBeenCalledOnce();
  });
  it('«Später» blendet ihn aus, ohne neu zu laden', () => {
    render(<UpdateBar />);
    const apply = vi.fn();
    act(() => offerUpdate(apply));
    fireEvent.click(screen.getByRole('button', { name: pwa.update.later }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('Hosting-Header (_headers für Cloudflare Pages und Netlify)', () => {
  const rules = headerRules(['/', '/impressum/']);
  const forPath = (p: string) => Object.assign({}, ...rules.filter((r) => matches(r.path, p)).map((r) => r.headers));

  it('CSP nur eigene Quellen, dazu nosniff, Referrer- und Permissions-Policy auf jeder Seite', () => {
    const h = forPath('/app/');
    expect(h['Content-Security-Policy']).toMatch(/^default-src 'self'; script-src 'self';/);
    expect(h['Content-Security-Policy']).toContain("object-src 'none'");
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toContain('camera=()');
  });
  it('gehashte Dateien für immer, HTML, Manifest und Service Worker immer frisch', () => {
    expect(forPath('/assets/app-abc123.js')['Cache-Control']).toBe('public, max-age=31536000, immutable');
    for (const p of ['/', '/index.html', '/app/', '/impressum/', '/sw.js', '/manifest.webmanifest']) expect(forPath(p)['Cache-Control'], p).toBe('no-cache');
  });
  it('Cloudflare Web Analytics kommt nur in die CSP, wenn die Messung eingeschaltet ist', () => {
    const on = headerRules([], true)[0].headers['Content-Security-Policy'];
    expect(on).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    expect(on).toContain("connect-src 'self' https://cloudflareinsights.com;");
    expect(headerRules([], false)[0].headers['Content-Security-Policy']).not.toContain('cloudflare');
    expect(csp()).not.toContain('unsafe');
    expect(headersFile(rules)).toMatch(/^\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
  });
});
