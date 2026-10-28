// Meilensteine und Abzeichen. Jeder wird genau einmal gefeiert (Schlüssel in seenMilestones).
// Nie gefeiert: viel Training, hohe Intensität, lange Einheiten.

const D = 86_400_000;

/** Tage ohne (bzw. seit Start beim Reduzieren). Nach einem Ausrutscher beginnt eine neue Serie. */
export const DAY_MILESTONES = [1, 7, 30, 100, 365];
/** Gespart in CHF, über die ganze Zeit (nicht pro Serie). */
export const MONEY_MILESTONES = [10, 50, 100, 500];
/** «Verlangen überstanden»: Kurz bewegt und eingeschätzt. */
export const CRAVING_BADGES = [1, 10, 25];
/** Anzahl eingetragener Trainings (nie Minuten oder Intensität). */
export const TRAINING_BADGES = [1, 10, 25, 50, 100];

/** Schlüssel für Abzeichen, die nicht zu einer Gewohnheit gehören. */
export const GLOBAL = '_alle';

export type Celebration = { kind: 'days'; n: number } | { kind: 'money'; n: number } | { kind: 'craving'; n: number } | { kind: 'training'; n: number };

export const dayKeyOf = (n: number, series: string) => `d${n}@${series}`;
export const moneyKeyOf = (n: number) => `m${n}`;

export function nextDayMilestone(ms: number): { prev: number; next: number | null; progress: number } {
  let prev = 0;
  for (const n of DAY_MILESTONES) {
    if (ms < n * D) return { prev, next: n, progress: (ms - prev * D) / ((n - prev) * D) };
    prev = n;
  }
  return { prev, next: null, progress: 1 };
}

/**
 * Alle erreichten Meilensteine einer Gewohnheit in einem Schritt finden.
 * Gefeiert wird nur der höchste neue, Tage vor Geld.
 */
export function detectMilestones(cleanMs: number, saved: number, seen: string[], series: string, hasMoney: boolean): { newKeys: string[]; celebrate: Celebration | null } {
  const set = new Set(seen);
  const newKeys: string[] = [];
  let days: Celebration | null = null;
  let money: Celebration | null = null;
  for (const n of DAY_MILESTONES) {
    const k = dayKeyOf(n, series);
    if (cleanMs >= n * D && !set.has(k)) {
      newKeys.push(k);
      days = { kind: 'days', n };
    }
  }
  if (hasMoney) {
    for (const n of MONEY_MILESTONES) {
      const k = moneyKeyOf(n);
      if (saved >= n && !set.has(k)) {
        newKeys.push(k);
        money = { kind: 'money', n };
      }
    }
  }
  return { newKeys, celebrate: days ?? money };
}

/** Abzeichen über alle Gewohnheiten: Verlangen überstanden und Trainings. */
export function detectBadges(cravings: number, trainings: number, seen: string[]): { newKeys: string[]; celebrate: Celebration | null } {
  const set = new Set(seen);
  const newKeys: string[] = [];
  let celebrate: Celebration | null = null;
  for (const n of CRAVING_BADGES) {
    if (cravings >= n && !set.has(`c${n}`)) {
      newKeys.push(`c${n}`);
      celebrate = { kind: 'craving', n };
    }
  }
  for (const n of TRAINING_BADGES) {
    if (trainings >= n && !set.has(`w${n}`)) {
      newKeys.push(`w${n}`);
      celebrate ??= { kind: 'training', n };
    }
  }
  return { newKeys, celebrate };
}

export interface Badge {
  key: string;
  kind: Celebration['kind'];
  n: number;
  reached: boolean;
}

/** Alle Abzeichen zum Anzeigen. Tage zählen hier die beste Serie (abgeschlossene Tage). */
export function badgeList(input: { bestDays: number; saved: number; cravings: number; trainings: number; hasMoney: boolean }): Badge[] {
  const out: Badge[] = DAY_MILESTONES.map((n) => ({ key: `d${n}`, kind: 'days' as const, n, reached: input.bestDays >= n }));
  if (input.hasMoney) out.push(...MONEY_MILESTONES.map((n) => ({ key: `m${n}`, kind: 'money' as const, n, reached: input.saved >= n })));
  out.push(...CRAVING_BADGES.map((n) => ({ key: `c${n}`, kind: 'craving' as const, n, reached: input.cravings >= n })));
  out.push(...TRAINING_BADGES.map((n) => ({ key: `w${n}`, kind: 'training' as const, n, reached: input.trainings >= n })));
  return out;
}

/**
 * Alte Schlüssel (v2: «t<ms>@serie» mit Stunden-Meilensteinen) in neue Tages-Schlüssel umrechnen,
 * damit nach dem Update nichts ein zweites Mal gefeiert wird.
 */
export function migrateSeenKeys(keys: string[]): string[] {
  const out = new Set(keys.filter((k) => !k.startsWith('t')));
  for (const k of keys) {
    const m = /^t(\d+)@(.+)$/.exec(k);
    if (!m) continue;
    const ms = Number(m[1]);
    for (const n of DAY_MILESTONES) if (ms >= n * D) out.add(dayKeyOf(n, m[2]));
  }
  // Geld-Meilenstein CHF 1000 gibt es nicht mehr
  out.delete('m1000');
  return [...out];
}
