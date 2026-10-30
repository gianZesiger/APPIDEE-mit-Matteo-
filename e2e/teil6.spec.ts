import type { Page } from '@playwright/test';
import { expect, noHorizontalScroll, test } from './fixtures';

// Teil 6: die übrigen Abläufe. Feste Uhr und «keine Konsolenfehler» kommen aus fixtures.ts.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });

async function startOwn(page: Page) {
  await page.goto('/app/');
  await page.getByRole('button', { name: /Mate/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Jetzt starten' }).click();
  await expect(page.getByText('Bisher gespart')).toBeVisible({ timeout: 8000 });
}

test('Notfall-Dialog per Tastatur öffnen und mit Esc schliessen', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  const sos = page.getByRole('button', { name: /Schwierig gerade\?/ });
  await sos.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(sos).toBeFocused();
});

test('Preisänderung gilt ab heute, rückwirkend korrigiert sie alles (mit Vorschau)', async ({ page }) => {
  await page.goto('/app/?modus=beispiel');
  await nav(page).getByText('Ziele', { exact: true }).click();
  const total = page.locator('.total-card [data-value]');
  const before = await total.getAttribute('data-value');
  await page.getByRole('button', { name: 'Mate bearbeiten' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Preis pro Einheit (CHF)').fill('9.90');
  // Rückwirkend zeigt zuerst eine Vorschau, aber wir speichern «ab heute»
  await sheet.getByLabel('Rückwirkend korrigieren (Tippfehler)').check();
  await expect(sheet.getByText(/Gespart: vorher CHF [\d’.]+, neu CHF [\d’.]+/)).toBeVisible();
  await sheet.getByLabel('Rückwirkend korrigieren (Tippfehler)').uncheck();
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toBeHidden();
  // Ab heute: die Vergangenheit bleibt, der Betrag steigt nur ein wenig (der heutige Teil)
  await expect(total).not.toHaveAttribute('data-value', before ?? '');
  const after = await total.getAttribute('data-value');
  const n = (s: string | null) => Number(s ?? 'NaN');
  expect(n(after)).toBeGreaterThanOrEqual(n(before));
  expect(n(after) - n(before)).toBeLessThan(9.9);
  await page.getByRole('button', { name: 'Mate bearbeiten' }).click();
  await expect(page.getByRole('dialog').getByText('Bisherige Werte')).toBeVisible();
});

test('Sicherung: Export und Wiederherstellen mit Vorschau, ungültige Datei mit klarer Meldung', async ({ page }) => {
  await startOwn(page);
  await nav(page).getByText('Profil', { exact: true }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Exportieren' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^weniger-sicherung-.*\.json$/);
  const json = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
  expect(JSON.parse(json).version).toBe(5);

  // Ungültig: klare Meldung, nichts wird ersetzt
  await page.getByLabel('Oder Sicherung hier einfügen').fill('{kaputt');
  await page.getByRole('button', { name: 'Eingefügte Sicherung laden' }).click();
  await expect(page.getByText('Dieser Text ist keine gültige Sicherung.')).toBeVisible();

  // Gültig: zuerst die Vorschau, ersetzt wird erst nach «Ersetzen»
  await page.getByLabel('Oder Sicherung hier einfügen').fill(json);
  await page.getByRole('button', { name: 'Eingefügte Sicherung laden' }).click();
  await expect(page.getByText(/^1 Gewohnheit, \d+ gute(r)? Tag(e)? – ersetzen\?$/)).toBeVisible();
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Sicherung geladen.')).toBeVisible();
});

test('kein seitliches Scrollen bei 320 px, auf der Startseite und in allen Tabs', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await noHorizontalScroll(page);
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  for (const name of ['Heute', 'Sport', 'Ziele', 'Profil']) {
    await nav(page).getByText(name, { exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    await noHorizontalScroll(page);
  }
});

test('Challenge-Link: frisch geöffnet und bei offener App', async ({ page }) => {
  await page.goto('/app/#challenge=mate-30');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Challenge: 30 Tage weniger Mate');
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  await page.evaluate(() => (location.hash = '#challenge=mate-7'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Challenge: 7 Tage weniger Mate/);
});
