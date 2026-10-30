import { expect, noHorizontalScroll, test } from './fixtures';
import { PUBLIC_URL } from '../src/config';

// Feste Uhr und «keine Konsolenfehler» kommen aus fixtures.ts.
test('Landing: Live-Rechner mit Chips, Menge und Preis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Weniger. Und du siehst, was es bringt.');
  // Der Rechner ist ein eigener Abschnitt unter dem Hero
  const h1 = page.locator('#rechner').getByRole('heading', { level: 2 });
  await expect(h1).toHaveText('Was kostet dich dein Mate im Jahr?');
  const total = page.locator('[data-total]');
  await page.locator('#rechner').scrollIntoViewIfNeeded();
  await expect(total).toHaveText('694');
  await expect(page.locator('[data-compare]')).not.toBeEmpty();

  await page.getByRole('radio', { name: 'Snus' }).click();
  await expect(h1).toHaveText('Was kostet dich dein Snus im Jahr?');
  await expect(page.getByText('Portionen pro Tag')).toBeVisible();
  await expect(total).toHaveText('1’022');

  await page.getByRole('button', { name: 'Mehr pro Tag' }).click();
  await expect(page.locator('[data-perday]')).toHaveText('9');
  await expect(total).toHaveText('1’150');

  await page.getByLabel('Preis pro Portion').fill('0.50');
  await expect(total).toHaveText('1’643');
  await expect(page.locator('[data-month]')).toHaveText('CHF 137 pro Monat');
  await noHorizontalScroll(page);

  // «Mit diesen Werten starten»: die App übernimmt Gewohnheit, Menge und Preis
  await page.getByRole('link', { name: 'Mit diesen Werten starten' }).click();
  await expect(page.getByRole('button', { name: /Snus/, pressed: true })).toBeVisible();
  await expect(page.getByText('Snus: rund CHF 1’643 im Jahr')).toBeVisible();
  expect(page.url()).not.toContain('vorlage=');
});

test('Landing: Start-Knopf führt in die App, ohne Konto', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: 'App öffnen' }).first();
  await expect(cta).toHaveAttribute('href', '/app/');
  await cta.click();
  await expect(page.getByRole('heading', { level: 1, name: /Was möchtest du/ })).toBeVisible();
});

test('Landing: Vertrauen, Fragen, Installieren-Tabs per Tastatur', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Kein Konto. Deine Einträge bleiben auf deinem Gerät, wir sehen sie nie.')).toBeVisible();
  await expect(page.getByText('Kein Tracking in der App.')).toBeVisible();
  await expect(page.getByText('Weniger ist ein Tagebuch, keine Therapie.').first()).toBeVisible();
  const q = page.getByText('Kostet es etwas?');
  await q.click();
  await expect(page.getByText(/Kein Abo, keine Werbung/)).toBeVisible();

  const iphone = page.getByRole('tab', { name: 'iPhone' });
  await iphone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Android' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Wähle «App installieren».')).toBeVisible();
  await expect(page.getByText('Wähle «Zum Home-Bildschirm».')).toBeHidden();
});

test('Rechner-Unterseiten sind vorgerendert und vorgewählt', async ({ page }) => {
  await page.goto('/vape-kosten-rechner/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was kostet dich dein Vape im Jahr?');
  await expect(page).toHaveTitle(/Vape-Kosten-Rechner/);
  await page.goto('/energydrink-kosten-rechner/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was kostet dich dein Energy im Jahr?');
  await noHorizontalScroll(page);
});

test.describe('Landing auf dem Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('zwei Spalten, Handy mit echter App, QR-Code am Schluss', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('.hero-text').boundingBox();
    const phone = await page.locator('.hero-phone').boundingBox();
    expect(phone!.x).toBeGreaterThan(text!.x + text!.width - 1);
    await expect(page.frameLocator('.phone-frame iframe').getByText('Bisher gespart')).toBeVisible({ timeout: 15_000 });
    await page.locator('.final').scrollIntoViewIfNeeded();
    // QR-Code nur mit öffentlicher Adresse (src/config.ts), sonst «Link folgt»
    if (PUBLIC_URL) await expect(page.locator('.final').getByRole('img', { name: 'QR-Code zur App' })).toBeVisible();
    else await expect(page.locator('.final').getByText('Link folgt')).toBeVisible();
    await noHorizontalScroll(page);
  });
});
