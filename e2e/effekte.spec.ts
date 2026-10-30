import { expect, test, type Page } from '@playwright/test';

// Effekte und ihr Budget. Hier mit Bewegung, damit die volle Stufe «hoch» geprüft wird.
test.use({ reducedMotion: 'no-preference' });

async function heuteMitStufe(page: Page, stufe: 'An' | 'Aus' | 'Automatisch') {
  await page.goto('/app/?modus=beispiel');
  await expect(page.getByText('Bisher gespart')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await nav.getByText('Profil', { exact: true }).click();
  await page.getByRole('radio', { name: stufe }).check();
  await nav.getByText('Heute', { exact: true }).click();
  await expect(page.getByText('Bisher gespart')).toBeVisible();
}

test('Leerlauf auf «Heute» mit Stufe hoch: höchstens 5 % CPU', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium' || info.project.name !== 'handy-hell', 'Messung über Chrome DevTools, einmal reicht');
  await heuteMitStufe(page, 'An');
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'hoch');
  await expect(page.locator('canvas.caustics')).toBeAttached();
  // Start, Nachladen und Übergänge abwarten
  await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const a = await metrics();
  await page.waitForTimeout(5000);
  const b = await metrics();
  const cpu = (b.TaskDuration - a.TaskDuration) / (b.Timestamp - a.Timestamp);
  info.annotations.push({ type: 'Leerlauf-CPU', description: `${(cpu * 100).toFixed(1)} %` });
  expect(cpu, 'Anteil Hauptthread im Leerlauf').toBeLessThan(0.05);
});

test('Effekte aus: ohne Lichtspiel und Unschärfe', async ({ page }) => {
  await heuteMitStufe(page, 'Aus');
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'tief');
  await expect(page.locator('canvas.caustics')).toHaveCount(0);
  expect(await page.locator('.nav').evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');

});

test('Ausrutscher- und Hilfe-Screens bleiben ruhig, auch auf Stufe hoch', async ({ page }) => {
  await heuteMitStufe(page, 'An');
  await page.getByRole('button', { name: /Schwierig gerade\?/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const calm = await sheet.evaluate((el) => {
    const all = [el, ...el.querySelectorAll('*')];
    return {
      animated: all.filter((x) => getComputedStyle(x).animationName !== 'none').length,
      blur: getComputedStyle(el).backdropFilter,
    };
  });
  expect(calm).toEqual({ animated: 0, blur: 'none' });
});

test('Landing: Kaustik im Hero, Zahl zählt hoch, Funken vor dem Start', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-fx', /hoch|mittel/);
  await expect(page.locator('.hero-caustics')).toBeAttached();
  await expect(page.locator('[data-total]')).toHaveText('694');
  // Nach dem Klick kommen kurz Funken, dann die App
  await page.getByRole('link', { name: 'Kostenlos starten, ohne Konto' }).first().click();
  await expect(page.locator('.spark-canvas')).toBeAttached();
  await expect(page).toHaveURL(/\/app\/$/);
});
