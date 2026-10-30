// Öffentliche Adresse der Website, ohne Schrägstrich am Ende,
// z. B. https://gianzesiger.github.io/APPIDEE-mit-Matteo- oder https://weniger.ch
//
// Eingetragen nach dem Einschalten von GitHub Pages. Bei einer eigenen Domain hier ändern.
// Solange leer: kein QR-Code (stattdessen «Link folgt»), canonical und Sitemap fehlen,
// Teilen und Challenge-Links nennen keine Adresse. Nie location.href verwenden.
export const PUBLIC_URL = 'https://gianzesiger.github.io/APPIDEE-mit-Matteo-';

/** Volle öffentliche Adresse zu einem Pfad, z. B. publicLink('/app/'). Leer, solange PUBLIC_URL leer ist. */
export function publicLink(path: string): string {
  const base = PUBLIC_URL.trim().replace(/\/+$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : '';
}
