// Vorgerenderte Seiten: wird beim Build (und im Dev-Server) in vite.config.ts ausgeführt.
// Landingpage, Rechner-Unterseiten und Rechtliches kommen fertig als HTML, Texte aus src/i18n/de-CH.ts.
// Im Browser läuft nur ein kleines Skript für den Rechner (src/landing/main.ts).
import { landing, legal, things, type CalcPage } from '../i18n/de-CH';
import { presetByKey, yearlyCost } from '../domain/presets';
import { moneyCompare } from '../domain/compare';
import { chf } from '../domain/format';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SiteOptions {
  /** Öffentliche Adresse ohne Schrägstrich am Ende, z.B. https://example.ch. Leer: relative Links. */
  site: string;
}

interface ShellInput {
  title: string;
  description: string;
  body: string;
  path: string;
  site: string;
  head?: string;
  index?: boolean;
  og?: boolean;
}

export function shell({ title, description, body, path, site, head = '', index = true, og = false }: ShellInput) {
  const url = `${site}${path}`;
  const meta = [
    `<link rel="canonical" href="${esc(url)}" vite-ignore />`,
    index ? '' : '<meta name="robots" content="noindex" />',
    og
      ? [
          '<meta property="og:type" content="website" />',
          '<meta property="og:locale" content="de_CH" />',
          `<meta property="og:site_name" content="${esc(legal.site)}" />`,
          `<meta property="og:title" content="${esc(title)}" />`,
          `<meta property="og:description" content="${esc(description)}" />`,
          `<meta property="og:url" content="${esc(url)}" />`,
          `<meta property="og:image" content="${esc(site)}/og.png" />`,
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
          '<meta name="twitter:card" content="summary_large_image" />',
          `<meta name="twitter:title" content="${esc(title)}" />`,
          `<meta name="twitter:description" content="${esc(description)}" />`,
          `<meta name="twitter:image" content="${esc(site)}/og.png" />`,
        ].join('\n    ')
      : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  return `<!doctype html>
<html lang="de-CH">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    ${meta}
    <meta name="theme-color" content="#e9f2f1" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#071a1d" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/src/landing/landing.css" />
${head}
  </head>
  <body>
${body}
  </body>
</html>
`;
}

function header() {
  const n = landing.nav;
  return `    <header class="lp-top">
      <a class="lp-brand" href="/"><span class="brand-mark" aria-hidden="true"></span>${esc(landing.appName)}</a>
      <nav class="lp-nav" aria-label="${esc(n.label)}"><a href="/#so-gehts">${esc(n.how)}</a><a href="/#funktionen">${esc(n.features)}</a><a href="/#fragen">${esc(n.faq)}</a></nav>
      <a class="lp-btn small" href="/app/">${esc(n.open)}</a>
    </header>`;
}

export function footer() {
  const f = legal.footer;
  const calcs = landing.pages.map((p) => `<a href="/${p.slug}/">${esc(landing.calcLinkLabel(landing.calc.find((c) => c.key === p.preset)?.chip ?? p.preset))}</a>`).join(' · ');
  return `    <footer class="lp-footer">
      <nav aria-label="${esc(landing.calcLinks)}">${calcs}</nav>
      <nav aria-label="Rechtliches"><a href="/datenschutz/">${f.privacy}</a> · <a href="/impressum/">${f.imprint}</a></nav>
      <p>${esc(f.help)}</p>
    </footer>`;
}

/** Für unbekannte Adressen (Cloudflare Pages und Netlify nehmen /404.html). Nicht in der Sitemap. */
function notFoundPage(site: string) {
  const n = legal.notFound;
  const body = `${header()}
    <main class="lp-legal">
      <h1>${esc(n.title)}</h1>
      <p class="lp-lead">${esc(n.text)}</p>
      <p><a class="lp-btn" href="/app/">${esc(legal.openApp)}</a></p>
      <p><a href="/">${esc(legal.back)}</a></p>
    </main>
${footer()}`;
  return shell({ title: `${n.title} – ${legal.site}`, description: n.description, body, path: '/404.html', site, index: false });
}

function legalPage(kind: 'imprint' | 'privacy', path: string, site: string) {
  const page = legal[kind];
  const intro = 'intro' in page ? `<p class="lp-lead">${esc(page.intro)}</p>` : '';
  const sections = page.sections
    .map((s) => `      <section>\n        <h2>${esc(s.h)}</h2>\n${s.p.map((p) => `        <p>${esc(p)}</p>`).join('\n')}\n      </section>`)
    .join('\n');
  const body = `${header()}
    <main class="lp-legal">
      <h1>${esc(page.title)}</h1>
      ${intro}
${sections}
      <p><a href="/">${legal.back}</a></p>
    </main>
${footer()}`;
  return shell({ title: `${page.title} – ${legal.site}`, description: page.description, body, path, site });
}

/** Ergebnis des Rechners, gleich wie im Browser (main.ts), damit ohne JavaScript schon Zahlen dastehen. */
export function calcResult(perDay: number, price: number) {
  const total = yearlyCost(perDay, price);
  const cmp = moneyCompare(total);
  return { total: chf(total, 0), compare: cmp ? landing.hero.compare(cmp.count, things[cmp.key]) : '' };
}

function calculator(presetKey: string) {
  const h = landing.hero;
  const item = landing.calc.find((c) => c.key === presetKey) ?? landing.calc[0];
  const p = presetByKey(item.key);
  const r = calcResult(p.perDay, p.price);
  const chips = landing.calc
    .map(
      (c) =>
        `<label class="lp-chip"><input type="radio" name="habit" value="${c.key}"${c.key === item.key ? ' checked' : ''} /><span>${esc(c.chip)}</span></label>`,
    )
    .join('');
  const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));
  return `<form class="calc" data-calc>
          <fieldset class="calc-chips"><legend>${esc(h.pick)}</legend>${chips}</fieldset>
          <div class="calc-inputs">
            <div class="calc-field">
              <span class="calc-label" id="perday-label" data-perday-label>${esc(item.perDayLabel)}</span>
              <div class="calc-stepper" role="group" aria-labelledby="perday-label">
                <button type="button" data-step="-1" aria-label="${esc(h.less)}">−</button>
                <output data-perday aria-live="polite">${fmt(p.perDay)}</output>
                <button type="button" data-step="1" aria-label="${esc(h.more)}">+</button>
              </div>
            </div>
            <div class="calc-field">
              <label class="calc-label" for="calc-price" data-price-label>${esc(item.priceLabel)}</label>
              <div class="calc-price"><span>${h.priceCurrency}</span><input id="calc-price" inputmode="decimal" autocomplete="off" value="${p.price.toFixed(2)}" data-price /></div>
            </div>
          </div>
          <div class="calc-result" aria-live="polite" aria-atomic="true">
            <span class="calc-eyebrow">${esc(h.resultLabel)}</span>
            <strong class="gold-num"><span class="cur">CHF</span> <span data-total>${r.total}</span></strong>
            <span class="calc-compare" data-compare>${esc(r.compare)}</span>
          </div>
          <p class="calc-note">${esc(h.note)}</p>
        </form>`;
}

function jsonLd(site: string, path: string) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: landing.appName,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    inLanguage: 'de-CH',
    description: landing.schemaDescription,
    url: `${site}/app/`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CHF' },
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${site}${path}`,
    mainEntity: landing.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  // «<» im JSON nie als Tag lesen lassen
  const safe = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');
  return `    <script type="application/ld+json">${safe(app)}</script>\n    <script type="application/ld+json">${safe(faq)}</script>`;
}

export function landingPage(site: string, page?: CalcPage) {
  const L = landing;
  const presetKey = page?.preset ?? 'mate';
  const item = L.calc.find((c) => c.key === presetKey) ?? L.calc[0];
  const path = page ? `/${page.slug}/` : '/';
  const q = L.hero.question(item.your);
  const [before, after] = q.split(item.your);
  const steps = L.how.steps.map((s, i) => `<li class="step reveal"><span class="step-n" aria-hidden="true">${i + 1}</span><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p></li>`).join('\n          ');
  const features = L.features.items
    .map(
      (f) => `<li class="feature tilt reveal">
            <img src="/screens/${f.img}.jpg" width="390" height="680" loading="lazy" decoding="async" alt="${esc(L.features.alt(f.h))}" />
            <h3>${esc(f.h)}</h3>
            <p>${esc(f.p)}</p>
          </li>`,
    )
    .join('\n          ');
  const trust = L.trust.points.map((p) => `<li>${esc(p)}</li>`).join('');
  const help = L.trust.help.map((h) => `<li><a href="${h.href}" target="_blank" rel="noreferrer">${esc(h.name)}</a> <span>${esc(h.text)}</span></li>`).join('');
  const faq = L.faq.items.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n        ');
  const ol = (list: string[]) => `<ol>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;

  const body = `${header()}
    <main id="inhalt">
      <section class="hero" aria-labelledby="hero-h">
        <div class="hero-bg" aria-hidden="true"><canvas class="hero-caustics"></canvas></div>
        <div class="hero-text">
          <p class="eyebrow">${esc(L.hero.eyebrow)}</p>
          <h1 id="hero-h">${esc(before)}<span class="grad" data-your>${esc(item.your)}</span>${esc(after)}</h1>
          ${page ? `<p class="lp-lead">${esc(page.intro)}</p>` : ''}
          ${calculator(presetKey)}
          <a class="lp-btn cta" href="/app/" data-start>${esc(L.hero.cta)}</a>
          <p class="cta-sub">${esc(L.hero.ctaSub)}</p>
        </div>
        <figure class="hero-phone">
          <div class="phone-frame"><iframe vite-ignore src="/app/?modus=beispiel&amp;rahmen=1" title="${esc(L.hero.phoneTitle)}" loading="lazy"></iframe></div>
          <figcaption>${esc(L.hero.phoneLabel)}</figcaption>
        </figure>
      </section>

      <section class="band" id="so-gehts" aria-labelledby="how-h">
        <h2 id="how-h">${esc(L.how.title)}</h2>
        <ol class="steps">
          ${steps}
        </ol>
      </section>

      <section class="band" id="funktionen" aria-labelledby="features-h">
        <h2 id="features-h">${esc(L.features.title)}</h2>
        <ul class="features">
          ${features}
        </ul>
      </section>

      <section class="band trust" aria-labelledby="trust-h">
        <h2 id="trust-h">${esc(L.trust.title)}</h2>
        <ul class="trust-points">${trust}</ul>
        <h3>${esc(L.trust.helpTitle)}</h3>
        <ul class="help-list">${help}</ul>
      </section>

      <section class="band" id="installieren" aria-labelledby="install-h">
        <h2 id="install-h">${esc(L.install.title)}</h2>
        <p>${esc(L.install.intro)}</p>
        <div class="tabs" role="tablist" aria-label="${esc(L.install.title)}">
          <button type="button" role="tab" id="tab-iphone" aria-controls="panel-iphone" aria-selected="true">${esc(L.install.tabs.iphone)}</button>
          <button type="button" role="tab" id="tab-android" aria-controls="panel-android" aria-selected="false" tabindex="-1">${esc(L.install.tabs.android)}</button>
        </div>
        <div class="tab-panel" role="tabpanel" id="panel-iphone" aria-labelledby="tab-iphone">${ol(L.install.iphone)}</div>
        <div class="tab-panel" role="tabpanel" id="panel-android" aria-labelledby="tab-android" hidden>${ol(L.install.android)}<button type="button" class="lp-btn" data-install hidden>${esc(L.install.button)}</button></div>
      </section>

      <section class="band" id="fragen" aria-labelledby="faq-h">
        <h2 id="faq-h">${esc(L.faq.title)}</h2>
        ${faq}
      </section>

      <section class="band final" aria-labelledby="final-h">
        <div>
          <h2 id="final-h">${esc(L.final.title)}</h2>
          <a class="lp-btn cta" href="/app/" data-start>${esc(L.hero.cta)}</a>
        </div>
        <figure class="final-qr" data-qr-box hidden>
          <svg data-qr role="img" aria-label="${esc(L.final.qrAlt)}" shape-rendering="crispEdges"></svg>
          <figcaption>${esc(L.final.qr)}</figcaption>
        </figure>
      </section>
    </main>
${footer()}
${jsonLd(site, path)}
    <script type="module" src="/src/landing/main.ts"></script>`;
  return shell({ title: page?.title ?? L.title, description: page?.description ?? L.description, body, path, site, og: true });
}

/** Seite nach Pfad. null: diese HTML-Datei wird nicht vorgerendert. */
export function prerender(path: string, { site }: SiteOptions): string | null {
  if (path === '/' || path === '/index.html') return landingPage(site);
  const page = landing.pages.find((p) => path.startsWith(`/${p.slug}`));
  if (page) return landingPage(site, page);
  if (path.startsWith('/datenschutz')) return legalPage('privacy', '/datenschutz/', site);
  if (path.startsWith('/impressum')) return legalPage('imprint', '/impressum/', site);
  if (path === '/404.html') return notFoundPage(site);
  return null;
}

/** Alle vorgerenderten Seiten (für sitemap.xml und den Build). */
export const PRERENDERED = ['/', ...landing.pages.map((p) => `/${p.slug}/`), '/datenschutz/', '/impressum/'];
