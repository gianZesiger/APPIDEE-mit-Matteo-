import type { Page } from '@playwright/test';
import { expect, noHorizontalScroll, test } from './fixtures';

// Feste Uhr und «keine Konsolenfehler» kommen aus fixtures.ts.
async function tab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByText(name, { exact: true }).click();
}

const DAY1 = /Dein erster Tag läuft/;

/** Eigene Gewohnheit über das Onboarding anlegen. */
async function startOwn(page: Page, habit = /Zigaretten/) {
  await page.goto('/app/');
  await page.getByRole('button', { name: habit }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Jetzt starten' }).click();
  await expect(page.getByText(DAY1)).toBeVisible({ timeout: 8000 });
}

test('Onboarding bis zum ersten Tag', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { level: 1, name: /Was möchtest du/ })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await noHorizontalScroll(page);
  await startOwn(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await noHorizontalScroll(page);
});

test('Onboarding passt bei 360 px ohne Scrollen, «Los geht’s» immer aktiv', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/app/');
  const go = page.getByRole('button', { name: /Los geht/ });
  await expect(go).toBeEnabled();
  const fits = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.tile')].map((t) => t.getBoundingClientRect());
    const bar = document.querySelector('.ob-bar')!.getBoundingClientRect();
    return {
      scroll: document.documentElement.scrollHeight - innerHeight,
      lastTile: Math.max(...tiles.map((r) => r.bottom)),
      barTop: bar.top,
      bar: bar.bottom,
    };
  });
  expect(fits.scroll, 'kein Scrollen nötig').toBeLessThanOrEqual(1);
  expect(fits.lastTile, 'alle Kacheln über dem Knopf').toBeLessThanOrEqual(fits.barTop);
  expect(fits.bar).toBeLessThanOrEqual(640);
  await go.click();
  await expect(page.getByRole('alert')).toContainText('Tipp zuerst an');
  await noHorizontalScroll(page);
});

test('Ring-Bogen ist sichtbar gezeichnet', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  const bar = page.locator('.ring-bar').first();
  await expect(bar).toBeVisible();
  const stroke = await bar.evaluate((el) => getComputedStyle(el).stroke);
  expect(stroke).not.toBe('none');
  expect(stroke).toContain('url(');
});

test('Heute: ein Ring mit «Bisher gespart», Notfall-Knopf, Sekunden auf Antippen', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  const since = page.getByRole('button', { name: /^Seit \d+ Tagen ohne Mate$/ });
  await expect(since).toBeVisible();
  await since.click();
  await expect(page.getByText(/\d+ Sekunden?$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Schwierig gerade\?/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Laufschuhe: noch CHF/ })).toBeVisible();
  // «＋ Gewohnheit» gehört in «Ziele»
  await expect(page.getByRole('button', { name: '＋ Gewohnheit' })).toHaveCount(0);
  await tab(page, 'Ziele');
  await expect(page.getByRole('button', { name: '＋ Gewohnheit' })).toBeVisible();
  await expect(page.getByText(/bisher 4 pro Tag → Woche 1: höchstens 3/)).toBeVisible();
});

test('Beispiel: Banner auf allen Tabs, eigene Daten bleiben unberührt', async ({ page }) => {
  await startOwn(page, /Snus/);
  await page.goto('/app/?modus=beispiel');
  for (const name of ['Heute', 'Sport', 'Ziele', 'Profil']) {
    await tab(page, name);
    await expect(page.getByText('Du siehst ein Beispiel.')).toBeVisible();
    await noHorizontalScroll(page);
  }
  // Im Beispiel trainieren: wird nicht gespeichert
  await tab(page, 'Sport');
  await page.getByRole('button', { name: 'Training eintragen', exact: true }).click();
  await page.getByRole('dialog', { name: 'Training eintragen' }).getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('button', { name: 'Eigene Gewohnheit starten' }).click();
  await expect(page.getByText('Du siehst ein Beispiel.')).toHaveCount(0);
  await tab(page, 'Heute');
  await expect(page.getByRole('tab', { name: /Mate/ })).toHaveCount(0);
  await tab(page, 'Sport');
  await expect(page.locator('.workout-row')).toHaveCount(0);
});

test('?modus=neu und ?modus=beispiel löschen oder überschreiben nie eigene Daten', async ({ page }) => {
  await startOwn(page, /Vape/);
  await page.goto('/app/?modus=neu');
  await expect(page.getByText(DAY1)).toBeVisible();
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Du siehst ein Beispiel.')).toBeVisible();
  expect(page.url()).not.toContain('modus=');
  await page.reload();
  await expect(page.getByText('Du siehst ein Beispiel.')).toHaveCount(0);
  await expect(page.getByText(/ohne Vape/)).toBeVisible();
});

test('Training eintragen, «Wie letztes Mal», Löschen mit Rückgängig, Reload behält Daten', async ({ page }) => {
  await startOwn(page);
  await tab(page, 'Sport');
  await expect(page.getByRole('button', { name: 'Training eintragen', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Training eintragen', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Training eintragen' });
  await sheet.getByRole('radio', { name: /Schwimmen/ }).click();
  await sheet.getByRole('button', { name: '45 Minuten', exact: true }).click();
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  // Die Meldung kann auch ein Abzeichen sein («Dein erstes Training …»)
  await expect(page.locator('.workout-row', { hasText: 'Schwimmen' })).toContainText('45 Minuten');
  await page.getByRole('button', { name: 'Training eintragen', exact: true }).click();
  await page.getByRole('dialog', { name: 'Training eintragen' }).getByRole('button', { name: /Wie letztes Mal/ }).click();
  await expect(page.locator('.workout-row', { hasText: 'Schwimmen' })).toHaveCount(2);
  await page.locator('.workout-row').first().getByRole('button', { name: /löschen/ }).click();
  await expect(page.locator('.workout-row', { hasText: 'Schwimmen' })).toHaveCount(1);
  await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.locator('.workout-row', { hasText: 'Schwimmen' })).toHaveCount(2);
  await page.reload();
  await tab(page, 'Sport');
  await expect(page.locator('.workout-row', { hasText: 'Schwimmen' })).toHaveCount(2);
  await noHorizontalScroll(page);
});

test('20 schnelle Tab-Wechsel ohne Fehler', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  const names = ['Sport', 'Ziele', 'Profil', 'Heute'];
  for (let i = 0; i < 20; i++) await tab(page, names[i % names.length]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('Kurz bewegen mit Timer und Verlangen-Frage', async ({ page }) => {
  await page.clock.install();
  await page.goto('/app/?modus=beispiel');
  await page.getByRole('button', { name: /Schwierig gerade\?/ }).click();
  await page.getByRole('button', { name: /Kurz bewegen/ }).click();
  await expect(page.getByText(/Hör auf bei Schmerz/)).toBeVisible();
  await page.getByRole('button', { name: /Sitzend/ }).click();
  await expect(page.getByText('Schritt 1 von 4')).toBeVisible();
  await page.clock.runFor(200_000);
  await expect(page.getByText('Wie stark ist das Verlangen jetzt?')).toBeVisible();
  await page.getByRole('radio', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Als Bewegung eintragen' }).click();
  await expect(page.locator('.toast')).toContainText('Bewegung eingetragen');
  await tab(page, 'Sport');
  await expect(page.locator('.workout-row').first()).toContainText('statt Verlangen');
});

test('Ausrutscher: Serie auf 0, gute Tage bleiben', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  const summary = page.getByText(/gute Tage insgesamt · Serie:/);
  const before = (await summary.textContent())?.match(/^(\d+) gute Tage/)?.[1];
  expect(before).toBeTruthy();
  await page.getByRole('button', { name: 'Ausrutscher festhalten' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ausrutscher festhalten' });
  await expect(sheet.getByText('Passiert. Und jetzt?')).toBeVisible();
  await sheet.getByRole('button', { name: /Weiter geht/ }).click();
  await expect(summary).toContainText('Serie: 0 Tage');
  await expect(summary).toContainText(`${before} gute Tage`);
});

test('Ziele: mehrere Sparziele in Reihenfolge', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await tab(page, 'Ziele');
  await page.getByLabel('Wofür sparst du?').fill('Konzert');
  await page.getByLabel('Betrag in CHF').fill('60');
  await page.getByRole('button', { name: 'Sparziel hinzufügen' }).click();
  const pots = page.locator('.pot strong');
  await expect(pots).toHaveText(['Laufschuhe', 'Konzert']);
  await page.getByRole('button', { name: 'Konzert nach oben' }).click();
  await expect(pots).toHaveText(['Konzert', 'Laufschuhe']);
  await expect(page.locator('.pot').first()).toContainText('geschafft');
});

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('links Erklärung und QR-Code, rechts die App im Handy-Rahmen', async ({ page }) => {
    await page.goto('/app/?modus=beispiel');
    await expect(page.getByRole('img', { name: 'QR-Code zur App' })).toBeVisible();
    const phone = await page.locator('.phone').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
    expect(phone && nav).toBeTruthy();
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(phone!.y + phone!.height + 1);
    expect(nav!.x).toBeGreaterThanOrEqual(phone!.x - 1);
    await tab(page, 'Ziele');
    await expect(page.getByRole('heading', { level: 1, name: 'Ziele' })).toBeVisible();
    await noHorizontalScroll(page);
  });
});

test('Datenschutz und Impressum sind vorgerendert', async ({ page }) => {
  await page.goto('/datenschutz/');
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeVisible();
  await expect(page.getByText(/Wir sehen sie nie/)).toBeVisible();
  await page.goto('/impressum/');
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await noHorizontalScroll(page);
});
