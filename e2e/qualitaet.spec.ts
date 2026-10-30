import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, FIXED_NOW, isDesktop, test } from './fixtures';

// Barrierefreiheit, Tastatur, Teilen-Karte, installierbare App und Hosting-Header.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });

/** Mit Tab weiter, bis das Ziel den Fokus hat (wie mit der Tastatur). */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Ziel mit Tab nicht erreicht');
}

/** Ernste und kritische Befunde von axe-core, gesammelt über alle Seiten. */
async function axe(page: Page, label: string, found: string[]) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const v of r.violations) if (v.impact === 'serious' || v.impact === 'critical') found.push(`${label} · ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('feste Uhr: alle Abläufe laufen an einem Mittwoch', async ({ page }) => {
  await page.goto('/app/');
  const now = await page.evaluate(() => Date.now());
  expect(now - FIXED_NOW.getTime()).toBeLessThan(60_000);
  expect(await page.evaluate(() => new Date().getDay())).toBe(3);
});

test('axe-core: keine ernsten Befunde auf Landing, Rechtlichem und allen App-Bildschirmen', async ({ page }) => {
  const found: string[] = [];
  for (const p of ['/', '/snus-kosten-rechner/', '/datenschutz/', '/impressum/', '/404.html']) {
    await page.goto(p);
    await axe(page, p, found);
  }
  await page.goto('/app/');
  await expect(page.getByRole('heading', { level: 1, name: /Was möchtest du/ })).toBeVisible();
  await axe(page, 'Onboarding', found);
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  await axe(page, 'Heute', found);
  await page.getByRole('button', { name: /Schwierig gerade\?/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await axe(page, 'Notfall-Sheet', found);
  await page.keyboard.press('Escape');
  for (const name of ['Sport', 'Ziele', 'Profil']) {
    await nav(page).getByText(name, { exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page, name, found);
  }
  expect(found).toEqual([]);
});

test('Tastatur: Navigation, Sheet öffnen, Fokus bleibt drin, Escape schliesst und Fokus kehrt zurück', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  const sport = nav(page).getByRole('link', { name: 'Sport' });
  await tabTo(page, sport);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Sport' })).toBeVisible();

  const add = page.getByRole('button', { name: 'Training eintragen' });
  await tabTo(page, add);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Fokus ist im Sheet und bleibt dort, auch nach vielen Tabs
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
});

test('Teilen-Karte: Vorschau, Auswahl, Bild herunterladen; Ausrutscher und Tagebuch nie im Bild', async ({ page }) => {
  // Ohne Web Share: dann wird das Bild heruntergeladen
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  await page.getByRole('button', { name: 'Teilen', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(dialog).not.toContainText(/Ausrutscher|Tagebuch|Auslöser/);
  await dialog.getByRole('radio', { name: 'Quadrat (1:1)' }).click();
  await dialog.getByLabel('Gewohnheit zeigen').uncheck();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Bild herunterladen' }).click();
  expect((await download).suggestedFilename()).toBe('weniger-square.png');
});

test('Kurzbefehle aus dem Manifest: #checkin zeigt den Check-in, #training öffnet den Eintrag', async ({ page }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: /Zigaretten/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Jetzt starten' }).click();
  await expect(page.getByText(/Dein erster Tag läuft/)).toBeVisible({ timeout: 8000 });

  await page.goto('/app/?quelle=kurzbefehl#checkin');
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Wie geht’s dir heute?' }) });
  await expect(card).toBeVisible();
  expect(await card.evaluate((c) => c.contains(document.activeElement))).toBe(true);
  await expect(page).toHaveURL(/#heute$/);

  await page.goto('/app/?quelle=kurzbefehl#training');
  await expect(page.getByRole('heading', { level: 1, name: 'Sport' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/#sport$/);
});

test('404-Seite für unbekannte Adressen, nicht in Suchmaschinen', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.getByRole('link', { name: 'App öffnen' }).last().click();
  await expect(page).toHaveURL(/\/app\/$/);
});

test('Sicherheits-Header: CSP, nosniff, Referrer, Permissions; Cache richtig', async ({ request }) => {
  const app = await request.get('/app/');
  const h = app.headers();
  expect(h['content-security-policy']).toMatch(/^default-src 'self';/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('geolocation=()');
  expect(h['cache-control']).toBe('no-cache');
  const js = (await app.text()).match(/src="(\/assets\/[^"]+\.js)"/)![1];
  expect((await request.get(js)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await request.get('/sw.js')).headers()['cache-control']).toBe('no-cache');
});

test.describe('Installierbare App', () => {
  test.use({ serviceWorkers: 'allow' });

  test('Manifest mit id, start_url, scope, Icons (auch maskable), Screenshots und Kurzbefehlen', async ({ page, request }) => {
    await page.goto('/app/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const m = await (await request.get(href!)).json();
    expect(m).toMatchObject({ id: '/app/', start_url: '/app/?quelle=pwa', scope: '/app/', display: 'standalone', lang: 'de-CH' });
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
    expect(m.shortcuts.map((s: { name: string }) => s.name)).toEqual(['Check-in', 'Training']);
    expect(m.screenshots.some((s: { form_factor: string }) => s.form_factor === 'wide')).toBe(true);
    expect(m.screenshots.some((s: { form_factor: string }) => s.form_factor === 'narrow')).toBe(true);
    const files = [...m.icons, ...m.screenshots].map((i: { src: string }) => i.src);
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    for (const f of [...files, apple!]) expect((await request.get(f)).status(), f).toBe(200);
  });

  test('Service Worker für /app/, danach auch offline', async ({ page, context }) => {
    test.skip(isDesktop(page), 'einmal pro Farbschema reicht');
    await page.goto('/app/?modus=beispiel');
    await expect(page.getByText('Bisher gespart')).toBeVisible();
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe('/app/');
    await context.setOffline(true);
    await page.goto('/app/');
    await expect(page.getByRole('heading', { level: 1, name: /Was möchtest du/ })).toBeVisible();
    await context.setOffline(false);
  });
});

test('Dialoge: sichtbarer Schliessen-Knopf, Hintergrund inert, Zurück-Taste schliesst zuerst den Dialog', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  await nav(page).getByText('Sport', { exact: true }).click();
  await expect(page).toHaveTitle('Sport · Weniger');
  await page.getByRole('button', { name: 'Training eintragen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Schliessen' })).toBeVisible();
  expect(await page.locator('main').evaluate((m) => m.closest('[inert]') !== null || m.hasAttribute('inert'))).toBe(true);
  await page.goBack();
  await expect(dialog).toBeHidden();
  // Weiter in der App: der Tab bleibt, erst das nächste «Zurück» geht zum vorherigen Tab
  await expect(page.getByRole('heading', { level: 1, name: 'Sport' })).toBeVisible();
  expect(await page.locator('main').evaluate((m) => m.hasAttribute('inert'))).toBe(false);
  await page.goBack();
  await expect(page).toHaveTitle('Heute · Weniger');
  await page.getByRole('button', { name: /Schwierig gerade\?/ }).click();
  await dialog.getByRole('button', { name: 'Schliessen' }).click();
  await expect(dialog).toBeHidden();
  // Kein Dialog-Eintrag bleibt im Verlauf zurück
  await expect(page).toHaveURL(/\/app\/(#heute)?$/);
  expect(await page.evaluate(() => history.state?.sheet)).toBeUndefined();
});

test('Nach dem Tab-Wechsel liegt der Fokus auf der Überschrift; Gewohnheiten wechseln mit Pfeiltasten', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  await nav(page).getByText('Ziele', { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ziele' })).toBeFocused();
  await nav(page).getByText('Heute', { exact: true }).click();
  const mate = page.getByRole('tab', { name: /Mate/ });
  await mate.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Kaffee/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Kaffee/ })).toBeFocused();
  await expect(mate).toHaveAttribute('tabindex', '-1');
});

test('Gesundheitshinweise: Alkohol beim Aufhören, Nikotin und Kaffee beim Reduzieren', async ({ page }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: /Alkohol/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await expect(page.getByText('Bei viel Alkohol täglich zuerst mit Hausärztin, Hausarzt oder einer Fachstelle reden.')).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: /Kaffee/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: /Lieber schrittweise reduzieren/ }).click();
  await expect(page.getByText(/Kopfschmerzen oder Reizbarkeit/)).toBeVisible();
});
