// Sicherheits- und Cache-Header für das Hosting. Cloudflare Pages und Netlify lesen beide die Datei
// dist/_headers im gleichen Format. Der Build schreibt sie, `vite preview` wendet dieselben Regeln an,
// damit die Tests unter der echten Content-Security-Policy laufen.

export interface HeaderRule {
  path: string;
  headers: Record<string, string>;
}

/** Nur eigene Quellen. Eine Mess-Adresse (VITE_ANALYTICS_SRC) kommt dazu, wenn sie gesetzt ist. */
export function csp(extra: string[] = []): string {
  const plus = extra.length ? ` ${extra.join(' ')}` : '';
  return [
    "default-src 'self'",
    `script-src 'self'${plus}`,
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${plus}`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function originOf(src: string): string {
  try {
    return src ? new URL(src).origin : '';
  } catch {
    return '';
  }
}

/** Regeln für alle Seiten: HTML, Service Worker und Manifest immer frisch, gehashte Dateien für immer. */
export function headerRules(pages: string[], analyticsSrc = ''): HeaderRule[] {
  const origin = originOf(analyticsSrc);
  const security = {
    'Content-Security-Policy': csp(origin ? [origin] : []),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000',
  };
  const fresh = ['/sw.js', '/manifest.webmanifest', '/404.html', '/app/', '/app/index.html', ...pages.flatMap((p) => (p.endsWith('/') ? [p, `${p}index.html`] : [p]))];
  return [
    { path: '/*', headers: security },
    { path: '/assets/*', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { path: '/workbox-*', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    ...[...new Set(fresh)].map((path) => ({ path, headers: { 'Cache-Control': 'no-cache' } })),
  ];
}

export function headersFile(rules: HeaderRule[]): string {
  const head = '# Erzeugt beim Build (src/landing/hosting.ts). Gilt für Cloudflare Pages und Netlify.\n';
  return head + rules.map((r) => `${r.path}\n${Object.entries(r.headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`).join('\n\n') + '\n';
}

/** Gleiche Regel-Logik wie bei den Hosts: * passt auf beliebig viele Zeichen. */
export function matches(pattern: string, path: string): boolean {
  const re = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(path);
}
