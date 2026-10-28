// Macht aus dem Einzeldatei-Build (dist-single/app/index.html) eine Seite zum Teilen als Artifact auf claude.ai.
// Der Viewer liefert Doctype, <head>, Zeichensatz und Viewport selbst, darum fallen sie hier weg,
// ebenso Manifest und Icons (dort nicht erreichbar). Ergebnis: artifact/index.html
// Aufruf: SINGLEFILE=1 npx vite build && node scripts/prepare-artifact.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('dist-single/app/index.html', 'utf8');
const strip = [
  /<!doctype html>\s*/i,
  /<html[^>]*>\s*/i,
  /<\/html>\s*/i,
  /<\/?head>\s*/gi,
  /<\/?body>\s*/gi,
  /<meta charset="[^"]*"\s*\/?>\s*/i,
  /<meta name="viewport"[^>]*>\s*/i,
  /<meta name="apple-mobile-web-app-capable"[^>]*>\s*/i,
  /<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/gi,
  /<title>[^<]*<\/title>\s*/i,
];
// Ersetzungsfunktion statt Text: der App-Code enthält «$'»-Muster
for (const re of strip) html = html.replace(re, () => '');
html = `<title>Weniger</title>\n${html}`;

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/index.html', html);
console.log(`artifact/index.html geschrieben (${Math.round(html.length / 1024)} KB)`);
