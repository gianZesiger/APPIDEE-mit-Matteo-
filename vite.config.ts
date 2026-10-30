/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { prerender, PRERENDERED } from './src/landing/prerender';
import { landing, pwa } from './src/i18n/de-CH';
import { headerRules, headersFile, matches } from './src/landing/hosting';
import { PUBLIC_URL } from './src/config';

// Mehrseiten-App:
//   /                          Landingpage (vorgerendert, wenig JavaScript)
//   /<gewohnheit>-kosten-rechner/  Rechner-Unterseiten (vorgerendert)
//   /app/                      die App (React)
//   /datenschutz/, /impressum/ (vorgerendert, ohne JavaScript)
// SINGLEFILE=1: nur die App als eine einzige HTML-Datei für die Vorschau.
// BASE_PATH=/APPIDEE-mit-Matteo-/: Basis-Pfad, wenn die Seite in einem Unterordner liegt (GitHub Pages).
const single = process.env.SINGLEFILE === '1';
const BASE = single ? './' : `/${(process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/');
const b = (p: string) => BASE.replace(/\/$/, '') + p;
const root = (p: string) => resolve(__dirname, p);

/** Ersetzt leere HTML-Hüllen durch die vorgerenderte Seite und schreibt robots.txt, sitemap.xml und _headers. */
function prerenderPages(site: string, analytics: boolean): Plugin {
  const rules = headerRules(PRERENDERED, analytics);
  return {
    name: 'weniger-prerender',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => prerender(ctx.path, { site, base: single ? '/' : BASE }) ?? html,
    },
    generateBundle() {
      if (single) return;
      const lines = ['User-agent: *', 'Allow: /'];
      if (site) {
        lines.push(`Sitemap: ${site}/sitemap.xml`);
        const urls = PRERENDERED.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      } else {
        this.warn('PUBLIC_URL in src/config.ts ist leer: canonical und OG-Bild sind relativ, keine sitemap.xml, kein QR-Code.');
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: lines.join('\n') + '\n' });
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile(rules) });
    },
    // vite preview mit denselben Headern wie beim Hoster (für die Tests unter echter CSP)
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        for (const r of rules) if (matches(r.path, path)) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
        next();
      });
    },
  };
}

/** Installierbare App unter /app/: Manifest, Workbox-Service-Worker mit Update-Hinweis (registerType 'prompt'). */
function pwaPlugin() {
  const shot = (name: keyof typeof pwa.screenshots, wide = false) => ({
    src: b(`/screens/${name}.jpg`),
    sizes: wide ? '1280x800' : '780x1360',
    type: 'image/jpeg',
    form_factor: wide ? ('wide' as const) : ('narrow' as const),
    label: pwa.screenshots[name],
  });
  return VitePWA({
    disable: single,
    registerType: 'prompt',
    injectRegister: false,
    scope: b('/app/'),
    filename: 'sw.js',
    manifestFilename: 'manifest.webmanifest',
    includeManifestIcons: false,
    manifest: {
      id: b('/app/'),
      name: pwa.name,
      short_name: pwa.name,
      description: pwa.description,
      lang: 'de-CH',
      dir: 'ltr',
      start_url: b('/app/?quelle=pwa'),
      scope: b('/app/'),
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#e9f2f1',
      theme_color: '#0f7f7f',
      categories: ['health', 'lifestyle', 'finance'],
      icons: [
        { src: b('/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: b('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: b('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: b('/icon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
      screenshots: [shot('heute'), shot('sos'), shot('ziele'), shot('sport'), shot('desktop', true)],
      shortcuts: [
        { name: pwa.shortcuts.checkin.name, description: pwa.shortcuts.checkin.description, url: b('/app/?quelle=kurzbefehl#checkin'), icons: [{ src: b('/icon-192.png'), sizes: '192x192' }] },
        { name: pwa.shortcuts.training.name, description: pwa.shortcuts.training.description, url: b('/app/?quelle=kurzbefehl#training'), icons: [{ src: b('/icon-192.png'), sizes: '192x192' }] },
      ],
    },
    workbox: {
      // Offline: die App mit allen Bausteinen. Landingpage, OG-Bild und Werbebilder brauchen das nicht.
      globPatterns: ['app/index.html', 'assets/*.{js,css,woff2}', 'icon*.{png,svg}', 'apple-touch-icon.png'],
      navigateFallback: b('/app/index.html'),
      navigateFallbackAllowlist: [new RegExp(`^${b('/app/')}`)],
      cleanupOutdatedCaches: true,
    },
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  // Die öffentliche Adresse kommt nur aus src/config.ts
  const site = PUBLIC_URL.trim().replace(/\/+$/, '');
  const pages: Record<string, string> = {
    landing: root('index.html'),
    app: root('app/index.html'),
    datenschutz: root('datenschutz/index.html'),
    impressum: root('impressum/index.html'),
    notfound: root('404.html'),
  };
  for (const p of landing.pages) pages[p.slug] = root(`${p.slug}/index.html`);

  return {
    base: BASE,
    plugins: [react(), prerenderPages(site, !!(env.VITE_CF_ANALYTICS_TOKEN ?? '').trim()), pwaPlugin(), ...(single ? [viteSingleFile()] : [])],
    define: single ? { 'import.meta.env.VITE_SINGLEFILE': 'true' } : {},
    build: single
      ? { outDir: 'dist-single', emptyOutDir: true, rollupOptions: { input: { app: root('app/index.html') } } }
      : { outDir: 'dist', rollupOptions: { input: pages } },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      // Wie in der Schweiz rechnen, damit Sommer-/Winterzeit echt geprüft wird
      env: { TZ: 'Europe/Zurich' },
    },
  };
});
