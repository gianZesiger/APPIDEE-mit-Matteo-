/**
 * CHF in Alltagsdinge übersetzen. Richtwerte zum Vorstellen, keine Preisangaben.
 * Die Texte dazu stehen in i18n (things).
 */
export const THINGS = [
  { key: 'gipfeli', chf: 1.5 },
  { key: 'kafi', chf: 4.5 },
  { key: 'kino', chf: 18 },
  { key: 'velo', chf: 80 },
  { key: 'schuhe', chf: 150 },
  { key: 'berge', chf: 300 },
] as const;

export type ThingKey = (typeof THINGS)[number]['key'];

/**
 * Wählt den Vergleich, der am greifbarsten ist: das teuerste Ding, von dem es
 * mindestens zwei gibt, höchstens 20. Unter dem günstigsten Ding: kein Vergleich.
 */
export function moneyCompare(chf: number): { key: ThingKey; count: number } | null {
  if (!Number.isFinite(chf) || chf < THINGS[0].chf) return null;
  for (let i = THINGS.length - 1; i >= 0; i--) {
    const count = Math.floor(chf / THINGS[i].chf + 1e-9);
    if (count >= 2 && count <= 20) return { key: THINGS[i].key, count };
  }
  // Sehr grosse Beträge: das Teuerste, sonst das Günstigste einmal
  const top = THINGS[THINGS.length - 1];
  if (chf >= top.chf) return { key: top.key, count: Math.floor(chf / top.chf) };
  return { key: THINGS[0].key, count: 1 };
}
