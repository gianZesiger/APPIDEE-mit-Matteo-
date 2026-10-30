// Echte Screenshots der App für Landingpage und Manifest (public/screens/*.jpg) und das OG-Bild (public/og.png).
// Startet einen Vite-Server, öffnet die App mit Beispieldaten und fotografiert sie.
// Aufruf: node scripts/shots.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const server = await createServer({ server: { port: 5190, strictPort: true }, logLevel: 'error' });
await server.listen();
// Texte aus dem zentralen Text-Modul
const { landing } = await server.ssrLoadModule('/src/i18n/de-CH.ts');
const q = landing.hero.question('dein Mate').replace('Mate', '<span>Mate</span>');
const base = 'http://localhost:5190';
const browser = await chromium.launch();
mkdirSync('public/screens', { recursive: true });

const ctx = await browser.newContext({
  viewport: { width: 390, height: 680 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  reducedMotion: 'reduce',
  locale: 'de-CH',
  timezoneId: 'Europe/Zurich',
});
const page = await ctx.newPage();
// Feste Zeit an einem Mittwochnachmittag: kein Montags-Rückblick im Werbebild
const wed = new Date();
wed.setDate(wed.getDate() + ((3 - wed.getDay() + 7) % 7 || 7));
wed.setHours(16, 20, 0, 0);
await page.clock.setFixedTime(wed);
// Das Beispiel-Banner gehört nicht ins Werbebild
const hideBanner = () => page.addStyleTag({ content: '.banner{display:none!important}' });
const tab = (name) => page.getByRole('navigation', { name: 'Hauptnavigation' }).getByText(name, { exact: true }).click();
const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `public/screens/${name}.jpg`, type: 'jpeg', quality: 72 });
  console.log(`public/screens/${name}.jpg`);
};

await page.goto(`${base}/app/?modus=beispiel`);
await page.getByText('Bisher gespart').waitFor();
await hideBanner();
await shot('heute');

await page.getByRole('button', { name: /Schwierig gerade\?/ }).click();
await page.getByRole('dialog').waitFor();
await shot('sos');
await page.keyboard.press('Escape');

await tab('Ziele');
await page.getByRole('heading', { name: 'Sparziele' }).scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await shot('ziele');

await tab('Sport');
await page.getByRole('heading', { level: 1, name: 'Sport' }).waitFor();
await shot('sport');

// Teilen-Karte: Vorschau im Sheet
await tab('Heute');
await page.getByRole('button', { name: 'Teilen', exact: true }).first().click();
await page.getByRole('dialog').getByRole('img').waitFor();
await shot('teilen');
await page.keyboard.press('Escape');
await ctx.close();

// Wählen: Onboarding mit gewählter Kachel (leerer Speicher, eigener Kontext)
const ob = await browser.newContext({ viewport: { width: 390, height: 680 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce', locale: 'de-CH', timezoneId: 'Europe/Zurich' });
const obp = await ob.newPage();
await obp.goto(`${base}/app/`);
await obp.getByRole('button', { name: /Mate/ }).click();
await obp.waitForTimeout(400);
await obp.screenshot({ path: 'public/screens/start.jpg', type: 'jpeg', quality: 72 });
console.log('public/screens/start.jpg');
await ob.close();

// Wochenrückblick: an einem Montagmorgen
const mon = await browser.newContext({ viewport: { width: 390, height: 680 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce', locale: 'de-CH', timezoneId: 'Europe/Zurich' });
const monp = await mon.newPage();
const monday = new Date(wed);
monday.setDate(monday.getDate() + ((1 - monday.getDay() + 7) % 7 || 7));
monday.setHours(9, 0, 0, 0);
await monp.clock.setFixedTime(monday);
await monp.goto(`${base}/app/?modus=beispiel`);
await monp.getByText('Deine letzte Woche').waitFor();
await monp.addStyleTag({ content: '.banner{display:none!important}' });
await monp.waitForTimeout(400);
await monp.screenshot({ path: 'public/screens/rueckblick.jpg', type: 'jpeg', quality: 72 });
console.log('public/screens/rueckblick.jpg');
await mon.close();

// Breites Bild für das Manifest (form_factor wide): die App auf dem Computer
const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'de-CH', timezoneId: 'Europe/Zurich' });
const desk = await wide.newPage();
await desk.clock.setFixedTime(wed);
await desk.goto(`${base}/app/?modus=beispiel`);
await desk.getByText('Bisher gespart').waitFor();
// Banner und QR-Code (zeigt die lokale Adresse) gehören nicht ins Bild
await desk.addStyleTag({ content: '.banner,.desk-qr{display:none!important}' });
await desk.waitForTimeout(500);
await desk.screenshot({ path: 'public/screens/desktop.jpg', type: 'jpeg', quality: 72 });
console.log('public/screens/desktop.jpg');
await wide.close();

// OG-Bild 1200×630: Frage, Marke und ein echter App-Bildschirm
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const shotData = `data:image/jpeg;base64,${readFileSync('public/screens/heute.jpg').toString('base64')}`;
await og.goto(`${base}/impressum/`);
await og.setContent(`<!doctype html><html lang="de-CH"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Familjen Grotesk';font-weight:700;src:url('${base}/src/assets/fonts/familjen-grotesk-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Instrument Sans';font-weight:600;src:url('${base}/src/assets/fonts/instrument-sans-latin-600-normal.woff2') format('woff2')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:'Instrument Sans',sans-serif;color:#e4f0ee;
background:radial-gradient(60% 80% at 85% 10%,rgba(60,199,190,.28),transparent 70%),radial-gradient(50% 60% at 5% 100%,rgba(226,193,127,.2),transparent 70%),linear-gradient(135deg,#04262b,#071a1d);
display:grid;grid-template-columns:1fr 330px;gap:40px;padding:64px 72px;align-items:center}
.brand{display:flex;align-items:center;gap:14px;font:700 40px 'Familjen Grotesk';margin-bottom:28px}
.mark{width:40px;height:40px;border-radius:50%;border:9px solid #3cc7be;position:relative}
.mark::after{content:'';position:absolute;inset:5px;border-radius:50%;background:#e2c17f}
h1{font:700 74px/1.02 'Familjen Grotesk';letter-spacing:-.02em}
h1 span{color:#e2c17f}
p{margin-top:26px;font-size:28px;color:#93aeab}
.phone{width:300px;height:520px;border-radius:40px;overflow:hidden;box-shadow:0 0 0 9px #e4f0ee,0 30px 60px rgba(0,0,0,.5)}
.phone img{width:100%;display:block}
</style></head><body>
<div><div class="brand"><span class="mark"></span>${landing.appName}</div>
<h1>${q}</h1>
<p>${landing.hero.eyebrow}</p></div>
<div class="phone"><img src="${shotData}" alt=""></div>
</body></html>`);
await og.evaluate(() => document.fonts.ready);
await og.waitForTimeout(300);
await og.screenshot({ path: 'public/og.png' });
console.log('public/og.png');

await browser.close();
await server.close();
