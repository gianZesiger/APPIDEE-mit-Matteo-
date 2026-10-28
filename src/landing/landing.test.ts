import { describe, expect, it } from 'vitest';
import { calcResult, prerender, PRERENDERED } from './prerender';
import { landing } from '../i18n/de-CH';
import { presetByKey, yearlyCost } from '../domain/presets';

const site = 'https://beispiel.test';
const page = (p: string) => prerender(p, { site })!;
const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

describe('Landingpage vorgerendert', () => {
  it('SEO-Titel, canonical, OG-Bild 1200×630, twitter:card', () => {
    const html = page('/index.html');
    expect(html).toContain(`<title>${landing.title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://beispiel.test/"');
    expect(html).toContain('<meta property="og:image" content="https://beispiel.test/og.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<html lang="de-CH">');
  });

  it('SoftwareApplication kostet 0 CHF und hat keine Bewertungen; FAQPage passt zu den Fragen', () => {
    const [app, faq] = ld(page('/'));
    expect(app['@type']).toBe('SoftwareApplication');
    expect(app.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'CHF' });
    expect(JSON.stringify(app)).not.toMatch(/aggregateRating|review/i);
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity).toHaveLength(landing.faq.items.length);
  });

  it('ohne JavaScript stehen schon Zahlen da: Mate 1 pro Tag zu CHF 1.90', () => {
    const html = page('/');
    const p = presetByKey('mate');
    expect(html).toContain(`<span data-total>${calcResult(p.perDay, p.price).total}</span>`);
    expect(calcResult(1, 1.9).total).toBe('694');
    expect(yearlyCost(-1, 2)).toBe(0);
  });

  it('jede Rechner-Unterseite hat eigenen Titel, eigene Adresse und die passende Vorwahl', () => {
    for (const pg of landing.pages) {
      const html = page(`/${pg.slug}/index.html`);
      expect(html).toContain(`<title>${pg.title.replace(/&/g, '&amp;')}</title>`);
      expect(html).toContain(`href="https://beispiel.test/${pg.slug}/"`);
      expect(html).toMatch(new RegExp(`value="${pg.preset}" checked`));
    }
    expect(PRERENDERED).toHaveLength(1 + landing.pages.length + 2);
  });

  it('ohne Domain: relative Adressen statt geratener Domain', () => {
    const html = prerender('/', { site: '' })!;
    expect(html).toContain('<link rel="canonical" href="/"');
    expect(html).toContain('content="/og.png"');
  });

  it('Texte sind geschützt: kein ungeschütztes HTML aus den Texten', () => {
    expect(prerender('/datenschutz/', { site })).toContain('[[BITTE AUSFÜLLEN]]');
    expect(page('/')).not.toMatch(/<script>(?!.*ld\+json)/);
  });
});
