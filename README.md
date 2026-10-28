# Weniger

App für Erwachsene in der Schweiz, die eine Gewohnheit loswerden oder reduzieren wollen: Mate, Snus, Vape, Zigaretten, Energy, Kaffee, Alkohol oder etwas Eigenes. Live sehen, wie viel du sparst, gute Tage sammeln, Ausrutscher ohne Scham, Notfall-Knopf, Sparziele und ein Sport-Tagebuch. Ohne Konto. Design «Aare-Licht».

**Datenschutz:** Kein Login, keine Werbung, kein Tracking in der App. Alle Einträge bleiben im Browser auf deinem Gerät (IndexedDB). Mit «Sicherung herunterladen» nimmst du sie mit. Die Landingpage kann optional ohne Cookies gemessen werden (Standard: aus).

## Starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev          # http://localhost:5173 (Landingpage), /app/ ist die App
npm test             # Unit-Tests (Vitest, Zeitzone Europe/Zurich)
npm run test:e2e     # baut und prüft im Browser (Playwright)
npm run build        # fertige Seite in dist/, danach Grössen-Budget (size-limit)
```

Für Playwright einmalig den Browser holen: `npx playwright install chromium`.

Beispieldaten zum Zeigen: `/app/?modus=beispiel`. Das Beispiel lebt nur im Arbeitsspeicher und überschreibt nie eigene Daten.

## Seiten

| Adresse | Inhalt |
| --- | --- |
| `/` | Landingpage mit Live-Rechner, vorgerendert |
| `/snus-kosten-rechner/` und drei weitere | Rechner-Unterseiten mit eigener Vorwahl |
| `/app/` | die App (React), installierbar, offline |
| `/datenschutz/`, `/impressum/`, `/404.html` | vorgerendert, ohne JavaScript |

Alle Texte stehen in `src/i18n/de-CH.ts` (Schweizer Schreibweise ohne scharfes S; ein Test prüft das).

## Online stellen

Der Build schreibt alles, was der Hoster braucht, nach `dist/`, auch `_headers` mit Content-Security-Policy (`default-src 'self'`), `nosniff`, Referrer- und Permissions-Policy sowie Cache-Regeln (gehashte Dateien für immer, HTML, Manifest und Service Worker nie aus dem Cache).

**Cloudflare Pages:** Projekt mit dem Repository verbinden. Build command `npm run build`, Build output `dist`, Umgebungsvariable `NODE_VERSION=22`.

**Netlify:** Build und Ausgabe stehen in `netlify.toml`.

Umgebungsvariablen (beim Hoster oder in `.env`, siehe `.env.example`):

- `VITE_SITE_URL` – öffentliche Adresse, z. B. `https://weniger.example`. Ohne sie sind canonical und OG-Bild relativ und es gibt keine `sitemap.xml`.
- `VITE_ANALYTICS`, `VITE_ANALYTICS_SRC`, `VITE_ANALYTICS_ID` – optionale Messung auf der Landingpage (Umami oder Plausible). Der Host kommt automatisch in die CSP.

## Vor dem Start ausfüllen

Im Code steht dafür `[[BITTE AUSFÜLLEN]]`:

- Impressum: Name, Adresse, E-Mail
- Datenschutzerklärung: Hoster, Messdienst (falls genutzt), Stand-Datum
- `VITE_SITE_URL` (Domain)
- Messung: `VITE_ANALYTICS*` (oder leer lassen)

## Installierbare App

`vite-plugin-pwa` mit Workbox, `registerType: 'prompt'`: Ist eine neue Version geladen, fragt die App «Neue Version da. Neu laden?» statt still neu zu laden. Manifest mit `id`, `start_url: /app/?quelle=pwa`, `scope: /app/`, Icons 192 und 512, eigenem maskierbarem Icon, Apple-Touch-Icon 180, Screenshots (schmal und breit) und den Kurzbefehlen «Check-in» (`/app/#checkin`) und «Training» (`/app/#training`).

- Icons neu erzeugen: `npm run icons`
- Screenshots für Landingpage, Manifest und OG-Bild neu machen: `node scripts/shots.mjs`

## Effekte

`html[data-fx=hoch|mittel|tief]`, gewählt aus `prefers-reduced-motion`, Datensparen, Prozessorkernen, Arbeitsspeicher und einer 2-Sekunden-Messung der Bildrate. Die Wahl im Profil hat Vorrang. Die Kaustik ist ein kleiner WebGL-Shader (20 Bilder pro Sekunde) und pausiert im Hintergrund und nach 20 Sekunden ohne Eingabe. Ausrutscher- und Hilfe-Screens bleiben immer ruhig.

## Qualität

| Prüfung | Wo |
| --- | --- |
| Lint, Typen | `npm run lint`, `npx tsc -b` |
| Unit-Tests: Rechenlogik, Store, Migrationen, Import, Sommerzeit, kein scharfes S, Header, Update-Hinweis | `npm test` |
| Grössen-Budget: App-Start ≤ 110 KB, Landingpage ≤ 30 KB JavaScript (gzip) | `npm run build` (size-limit, `.size-limit.cjs`) |
| Abläufe bei 390 und 1280 px, hell und dunkel, feste Uhr, gegen den Produktions-Build mit echter CSP; dazu axe-core, Tastatur, Teilen-Karte, Kurzbefehle, offline | `npm run test:e2e` |
| Leerlauf-CPU auf «Heute» ≤ 5 % (Stufe hoch) | `e2e/effekte.spec.ts` |

GitHub Actions (`.github/workflows/ci.yml`) führt alles aus: `npm ci`, Lint, `tsc -b`, Vitest, Build mit size-limit, Playwright.

Ziele, die noch nicht gemessen sind: Lighthouse mobil ≥ 95, Barrierefreiheit, Best Practices und SEO 100, LCP unter 2 Sekunden, CLS unter 0.05.

## Aufbau

```
src/
  domain/      reine Rechenlogik und Tests (gute Tage, Serie, Ersparnis, Meilensteine, Sport, Sicherung, Migration)
  app/         Store, App-Hülle, Service Worker und Update-Hinweis, Kurzbefehle
  features/    Heute, Sport, Ziele, Profil, Onboarding, Teilen, Desktop
  ui/          Ring, Sheet, Toast, Zählwerk, Effektstufen
  fx/          Kaustik (WebGL), Funken, Ripple, Tilt, Scroll-Reveal (nachgeladen)
  landing/     Vorrendern, Rechner, Messung, Hosting-Header
  i18n/        alle Texte (de-CH)
e2e/           Playwright-Abläufe
scripts/       Icons, Screenshots, Einzeldatei-Vorschau
```

## Regeln, die im Code stecken

- Gute Tage werden nie gelöscht. Ein Ausrutscher setzt die Serie auf 0. Ereignisse vor dem Start zählen nicht.
- Meilensteine bei 1, 7, 30, 100 und 365 Tagen und bei CHF 10, 50, 100 und 500. Gefeiert wird nur der höchste neue.
- Sport: Woche Montag bis Sonntag (Europe/Zurich), Ruhetage zählen positiv, keine Kalorien, keine Rangliste. Wochenziel 30 bis 600 Minuten, Standard 150 (Orientierung: WHO, 150 bis 300 Minuten pro Woche für Erwachsene).
- Teilen-Karten zeigen nur, was du auswählst. Ausrutscher, Tagebuch und Auslöser kommen nie ins Bild.
- Sicherung laden prüft jedes Feld, verwirft Ungültiges, höchstens 2 MB.
- Hilfe ist immer erreichbar: SafeZone.ch und Rauchstopplinie 0848 000 181 (stopsmoking.ch).
