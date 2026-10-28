# Prompt v3 für Claude Code: «Weniger Solo» mit Sport und Aare-Licht-Design

Kopiere alles ab der Linie in Claude Code, im Ordner des Projekts `weniger-solo`.

---

Du verbesserst die App «Weniger Solo» (React 19, TypeScript, Vite, Zustand). Sie hilft Erwachsenen in der Schweiz, Gewohnheiten loszuwerden oder zu reduzieren (Zigaretten, Snus, Vape, Mate, Energy Drink, Kaffee, Süsses, Alkohol, Social Media, eigene Gewohnheit), und hat ein Sport-Tagebuch. Es gibt keine Gruppe. Die App muss in 5 Sekunden begeistern: sehr attraktiv, mit vielen Effekten, aber ruhig lesbar.

Lies zuerst den bestehenden Code (`src/domain`, `src/screens`, `src/components`, `src/store.ts`, `src/styles.css`) und führe `npm test` aus. Behalte, was funktioniert. Arbeite in kleinen Schritten, nach jedem Schritt laufen Tests und Build.

## Regeln für Sprache und Inhalt
- Deutsch, Schweizer Rechtschreibung, nie das scharfe S, du-Form, CHF mit Apostroph als Tausendertrennung (3'285.00).
- Kurz, warm, nie beschämend. Keine Technikwörter (kein «Backup», «Tracker», «Streak hart/weich», «abgeschlossene Tage»).
- Keine Heilversprechen. Erlaubt: «Kurze Bewegung kann das Verlangen im Moment dämpfen.» Verboten: «Sport macht dich rauchfrei», «Deine Lunge erholt sich», Kalorien, Gewicht, BMI.
- Kein sichtbares «TODO». Hilfe: SafeZone.ch (anonyme Online-Suchtberatung, BAG) und Rauchstopplinie 0848 000 181 (stopsmoking.ch).
- Für Erwachsene ab 18, bestätigt im Onboarding.

## Design «Aare-Licht»
Bildwelt: Man schaut von oben in die Aare. Türkis-milchiges Gletscherwasser, Lichtnetze vom Flussgrund, Berner Sandstein als Gold.
- **Farben (CSS-Variablen, Hell/Dunkel):** Hintergrund #E9F2F1 / #071A1D, Karte #F8FBFA / #0E2629, Text #10312F / #E4F0EE, leise #4F6967 / #93AEAB, Primär #0F7F7F / #3CC7BE, Gold #B8914F / #E2C17F, Sport-Moos #4F7D2F / #9CCB6A, Ruhe-Blau #2F6F98 / #7FB8DA. Kontrast mindestens WCAG AA.
- **Schrift:** Familjen Grotesk (Titel, Zahlen), Instrument Sans (Text), Zahlen mit `tabular-nums`.
- **Formen:** Glas-Karten (leichter Blur, feine Kante), Ringe mit Verlauf statt Balken, Radius 24 px, Touch-Flächen mindestens 44 px.
- **Konsistenz:** zwei Easings (Spring `cubic-bezier(.34,1.56,.64,1)` und ease-out `cubic-bezier(.2,.8,.2,1)`), drei Dauern (150, 300, 600 ms).

## Effekte (alle mit Abschaltung)
1. **Kaustik-Hintergrund:** Canvas in kleiner Auflösung, 30 fps, pausiert bei `document.hidden`, dazu 3 bis 5 % Körnung (SVG feTurbulence). Nie hinter Zahlen sichtbar stärker als 16 %.
2. **Ring mit Glow und Spitzenpunkt:** SVG mit Verlauf, `stroke-dashoffset`, Punkt in einer rotierenden Gruppe, pulsierender Schein dahinter.
3. **Zählwerk:** Geldbetrag mit einzeln rollenden Ziffern, live auf den Rappen (unter CHF 10 mit drei Nachkommastellen). Screenreader bekommt den Endwert.
4. **Lichtfunken (Canvas):** nur bei Meilensteinen, beim Start, bei Ruhetagen und beim Wochenziel. Nie für viele Trainings oder hohe Intensität.
5. **Karten-Tilt** mit Lichtfleck unter dem Zeiger (nur Maus), **Ripple** auf Buttons, **Spring-Druck** (scale .96).
6. **Tab-Wechsel** mit View Transitions API und Fallback, **Navigation** mit gleitender Blase.
7. **Glas-Sheets** mit Federsprung. Der Ausrutscher-Screen bleibt ohne Effekte.
8. **Gestaffelter Einstieg** der Karten pro Tab und **Scroll-Reveal**, aber Inhalte sind im Ruhezustand immer sichtbar (nie `opacity: 0` als Ausgangszustand).
9. **Glanz (Shimmer)** auf Sparzielen ab 80 %, wachsende Balken im Sport-Verlauf.
10. **Abschaltung:** `prefers-reduced-motion` und Schalter «Effekte reduzieren» im Profil. Animiert werden nur `transform` und `opacity`.

## Heute
- Ring bis zum nächsten Meilenstein, in der Mitte gespartes Geld live, «frei seit 2 Std 14 Min 07 s», Hinweis «Noch 46 Min bis 3 Stunden».
- Gewinn-Tage (werden nie gelöscht), Vermieden, Tage am Stück. Am ersten Tag «Tag 1 läuft gerade», nie nur Nullen.
- Check-in Zäh / Geht gut / Stark. «Zäh» öffnet sofort «Schwierig gerade?».
- **Schwierig gerade?** mit Wahl: Atmen (60 s, 4 s ein, 6 s aus) oder **Kurz bewegen** (sitzend, stehend, draussen; 2 bis 3 Minuten mit Timer). Danach «Wie stark ist das Verlangen jetzt?» (1 bis 5, privat) und optional «Als Bewegung eintragen». Sicherheitshinweis: aufhören bei Schmerz, Schwindel, Atemnot, Brustdruck.
- Karte «Bewegung diese Woche» mit kleinem Ring, führt zum Sport-Tab.
- «Das hast du schon» (CHF in Alltag übersetzt), Sparziel mit dem Total aller Ziele, Warum, 14-Tage-Streifen mit Text für Screenreader.

## Sport
- **Eintragen in unter 10 Sekunden:** Sheet mit 13 Sportarten (Laufen, Velo, Wandern, Spazieren, Schwimmen, Kraft, Fussball, Unihockey, Ski/Board, Langlauf, Bouldern, Yoga, Anderes), Dauer-Chips 15/30/45/60/90 plus Stepper, Heute/Gestern, «Wie letztes Mal» mit einem Tap. Optional: Distanz (nur wo sinnvoll), Anstrengung 1 bis 10 mit Worten, Gefühl danach (Leer, Okay, Gut, Stark).
- **Statistik:** Wochenring (Montag bis Sonntag, Europe/Zurich), 7 Punkte für aktive Tage und Ruhetage, Serie in **Wochen** (laufende Woche bricht sie nie), Verlauf 8 Wochen mit Ziellinie, Rekorde (längste Einheit, beste Woche, Distanz, Lieblingssport), Liste «Zuletzt» mit Löschen.
- **Wochenziel** frei 30 bis 600 Min, Standard 150. Orientierung: WHO nennt 150 bis 300 Minuten moderate Bewegung pro Woche für Erwachsene (Quelle verlinken: https://www.ncbi.nlm.nih.gov/books/NBK566048/).
- **Ruhetag eintragen** zählt positiv. Keine Tagesserien, keine Kalorien, keine Rangliste. Über 180 Min an einem Tag: sanfter Hinweis auf Erholung.
- **Verbindung zum Aufhören:** «Seit du weniger Mate: 19 Trainings, davon 1× Bewegung statt Verlangen.» Die Sport-Serie beeinflusst nie die Aufhör-Zahlen.
- Später (nicht jetzt): Import aus Apple Health und Health Connect über Capacitor. Strava und Garmin sind für ein Nebenprojekt derzeit nicht realistisch.

## Ziele und Profil
- Ziele: Gesamt gespart (Zählwerk), Karten pro Ziel, Reduktionsplan in Wochenstufen (bei Bruchzahlen in 0.5-Schritten), «Stufe verlängern», Sparziel, Bearbeiten. Startdatum erst beim Verlassen des Feldes übernehmen, nicht in der Zukunft, höchstens 5 Jahre zurück.
- Profil: Hilfe, Effekte reduzieren, Sicherung speichern (Datei plus Text zum Kopieren), Sicherung laden (Datei oder eingefügter Text), alles löschen mit Bestätigung in der App, Hinweis Beispieldaten.
- Beispieldaten: Button im Onboarding und `?modus=beispiel` bzw. `?modus=neu`. Klar als Beispiel markiert.

## Bekannte Fehler, die behoben bleiben müssen (Tests dafür schreiben)
1. Toast und Konfetti verschwinden auch, wenn die Seite jede Sekunde neu rendert (Callback über `useRef`).
2. Onboarding-Schritt 4 wird beim ersten Ziel nicht übersprungen.
3. Meilensteine: alle erreichten in einem Schritt markieren, nur den höchsten feiern, keine Duplikate, nach einem Ausrutscher neue Serie.
4. Ausrutscher heute: «Tage am Stück» fällt auf 0, Gewinn-Tage bleiben. Ereignisse vor dem Start zählen nicht.
5. Import prüft jedes Feld (Zahlen, Daten, Modus, Grösse bis 2 MB), verwirft Ungültiges, setzt Meilensteine zurück.
6. Gespeichert werden nur Nutzerdaten (`partialize`), mit Version und `migrate`.
7. Sheets: Startfokus, Fokusfalle, Fokus zurück. Fokus sichtbar, auch bei Eingabefeldern.

## Qualität
- Vitest für: Gewinn-Tage, Serie, Ersparnis, Reduktionsplan, Meilensteine, Sport-Woche (Montag), Wochenserie, Ruhetage, Rekorde, Import-Prüfung, Sommer-/Winterzeit (25.10.2026).
- Playwright (375×812, hell und dunkel, `reducedMotion: 'reduce'` für stabile Bilder): Onboarding, Beispieldaten, Training eintragen, «Wie letztes Mal», Kurz bewegen, Ausrutscher, Reload behält Daten.
- Keine horizontale Scrollleiste, keine Konsolenfehler.
- Am Ende: Tests grün, `npm run build` ohne Fehler, kurze Liste, was noch fehlt oder unsicher ist.
