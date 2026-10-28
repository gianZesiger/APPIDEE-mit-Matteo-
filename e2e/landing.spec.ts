import { expect, noHorizontalScroll, test } from './fixtures';

// Feste Uhr und «keine Konsolenfehler» kommen aus fixtures.ts.
test('Landing: Live-Rechner mit Chips, Menge und Preis', async ({ page }) => {
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('Was kostet dich dein Mate im Jahr?');
  const total = page.locator('[data-total]');
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
  await noHorizontalScroll(page);
});

test('Landing: Start-Knopf führt in die App, ohne Konto', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: 'Kostenlos starten, ohne Konto' }).first();
  await expect(cta).toHaveAttribute('href', '/app/');
  await cta.click();
  await expect(page.getByRole('heading', { level: 1, name: /Was möchtest du/ })).toBeVisible();
});

test('Landing: Vertrauen, Fragen, Installieren-Tabs per Tastatur', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Deine Einträge bleiben auf deinem Gerät. Wir sehen sie nie. Kein Konto, kein Tracking.')).toBeVisible();
  await expect(page.getByText('Weniger ist ein Tagebuch, keine Therapie.').first()).toBeVisible();
  const q = page.getByText('Ist Weniger wirklich gratis?');
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
  await page.goto('/energy-drink-kosten-rechner/');
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
    await expect(page.getByRole('img', { name: 'QR-Code zur App' })).toBeVisible();
    await noHorizontalScroll(page);
  });
});
