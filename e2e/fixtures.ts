import { expect, test as base, type Page } from '@playwright/test';

/** Feste Uhr für alle Abläufe: Mittwoch, 21. Oktober 2026, 10:00 in Zürich. Die Zeit läuft von dort aus weiter. */
export const FIXED_NOW = new Date('2026-10-21T10:00:00+02:00');

/**
 * Gemeinsame Grundlage: feste Uhr, keine Konsolenfehler (auch keine CSP-Verstösse),
 * am Ende ein Bild der ganzen Seite für den Bericht.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use, info) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.clock.install({ time: FIXED_NOW });
      await use(errors);
      await page.screenshot({ path: info.outputPath('ende.png'), fullPage: true }).catch(() => {});
      expect(errors, 'Konsolenfehler').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'horizontale Scrollleiste').toBeLessThanOrEqual(cw);
}

export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 900;
