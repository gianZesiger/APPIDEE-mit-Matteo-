// Startwerte je Gewohnheit: Menge pro Tag und Preis pro Einheit.
// Grobe Richtwerte, die Person passt sie im Onboarding und im Rechner an.
// Ohne Texte, damit die Landingpage sie laden kann, ohne die App-Texte mitzuziehen.

export interface Preset {
  key: string;
  emoji: string;
  perDay: number;
  price: number;
  step: number;
  timeBased?: boolean; // Social Media: Stunden statt Geld
}

// Preise sind grobe Startwerte und werden im Onboarding zum Anpassen angezeigt.
// Reihenfolge wie die Kacheln: zuerst das, was 18- bis 35-Jährige am häufigsten weniger möchten.
export const PRESETS: Preset[] = [
  { key: 'snus', emoji: '🫙', perDay: 8, price: 0.35, step: 1 },
  { key: 'vape', emoji: '💨', perDay: 0.5, price: 8, step: 0.5 },
  { key: 'zig', emoji: '🚬', perDay: 15, price: 0.45, step: 1 },
  { key: 'energy', emoji: '⚡', perDay: 1, price: 1.8, step: 1 },
  { key: 'mate', emoji: '🧉', perDay: 1, price: 1.9, step: 1 },
  { key: 'kaffee', emoji: '☕', perDay: 3, price: 1.2, step: 1 },
  { key: 'alkohol', emoji: '🍺', perDay: 1, price: 6, step: 0.5 },
  { key: 'social', emoji: '📱', perDay: 3, price: 0, step: 0.5, timeBased: true },
  { key: 'zucker', emoji: '🍬', perDay: 2, price: 1.5, step: 1 },
  { key: 'eigene', emoji: '✨', perDay: 3, price: 0, step: 1 },
];

export const presetByKey = (key: string) => PRESETS.find((p) => p.key === key) ?? PRESETS[0];

/** Kosten im Jahr bei gleichbleibendem Konsum. */
export function yearlyCost(perDay: number, price: number): number {
  const v = Math.max(0, perDay) * Math.max(0, price) * 365;
  return Number.isFinite(v) ? v : 0;
}
