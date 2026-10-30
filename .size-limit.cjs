// Grössen-Budget (gzip), geprüft nach jedem Build:
//   App beim Start: höchstens 110 KB JavaScript (Einstieg und alles, was er sofort lädt)
//   Landingpage:    höchstens 30 KB JavaScript (inklusive allem, was sie später nachlädt)
// Die Dateinamen enthalten Hashes, darum werden sie aus dem fertigen HTML gelesen.
const { readFileSync, existsSync } = require('node:fs');
const { join, dirname, basename } = require('node:path');

const dist = join(__dirname, 'dist');
const assets = join(dist, 'assets');

function htmlScripts(page) {
  const html = readFileSync(join(dist, page), 'utf8');
  const urls = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g), ...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  // Mit Basis-Pfad (GitHub Pages) beginnen die Adressen mit /<repo>/assets/: nur der Teil ab assets/ zählt
  return urls.map((u) => join(assets, basename(u)));
}

/** Folgt den Importen einer Datei; mit lazy auch den dynamischen (import("./x.js")). */
function follow(files, lazy) {
  const seen = new Set();
  const queue = [...files];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    const statics = [...src.matchAll(/(?:from|import)\s*"\.\/([\w.-]+\.js)"/g)].map((m) => m[1]);
    const dynamics = lazy ? [...src.matchAll(/import\("\.\/([\w.-]+\.js)"\)/g), ...src.matchAll(/"assets\/([\w.-]+\.js)"/g)].map((m) => m[1]) : [];
    for (const name of [...statics, ...dynamics]) queue.push(join(dirname(f), basename(name)));
  }
  // size-limit liest Glob-Muster: relative Pfade mit / (auch unter Windows)
  return [...seen].filter((f) => f.startsWith(assets)).map((f) => `dist/assets/${basename(f)}`);
}

module.exports = [
  { name: 'App beim Start', path: follow(htmlScripts('app/index.html'), false), limit: '110 kB', gzip: true },
  { name: 'Landingpage (alles)', path: follow(htmlScripts('index.html'), true), limit: '30 kB', gzip: true },
];
