// Meilensteine: Tage am Stück, Geld gespart und «Verlangen überstanden».
// Jeder wird einmal gefeiert. Fällt ein Wert (z. B. nach einer Korrektur) unter die Grenze,
// wird die Feier zurückgesetzt und beim nächsten Erreichen wieder gefeiert.

/** Tage am Stück (Serie). */
export const DAY_MILESTONES = [1, 7, 30, 100, 365];
/** Gespart in CHF. */
export const MONEY_MILESTONES = [10, 50, 100, 500];
/** «Verlangen überstanden»: einmal reicht. */
export const CRAVING_BADGES = [1];

/** Schlüssel für Abzeichen, die nicht zu einer Gewohnheit gehören. */
export const GLOBAL = '_alle';

export type Celebration = { kind: 'days'; n: number } | { kind: 'money'; n: number } | { kind: 'craving'; n: number };

export const dayKeyOf = (n: number) => `d${n}`;
export const moneyKeyOf = (n: number) => `m${n}`;

/** Nächster Tages-Meilenstein und Fortschritt dorthin, nach der Serie in Tagen. */
export function nextDayMilestone(streak: number): { prev: number; next: number | null; progress: number; left: number } {
  let prev = 0;
  for (const n of DAY_MILESTONES) {
    if (streak < n) return { prev, next: n, progress: (streak - prev) / (n - prev), left: n - streak };
    prev = n;
  }
  return { prev, next: null, progress: 1, left: 0 };
}

/**
 * Gleicht die gefeierten Meilensteine einer Gewohnheit mit dem aktuellen Stand ab.
 * keep: was bleibt (zurückgesetzt ist, was nicht mehr erreicht ist), newKeys: neu erreicht,
 * celebrate: der höchste neue (Tage vor Geld).
 */
export function reconcileMilestones(
  streak: number,
  saved: number,
  seen: string[],
  hasMoney: boolean,
): { keep: string[]; newKeys: string[]; celebrate: Celebration | null; changed: boolean } {
  const reached = new Set<string>();
  let days: Celebration | null = null;
  let money: Celebration | null = null;
  for (const n of DAY_MILESTONES) if (streak >= n) reached.add(dayKeyOf(n));
  if (hasMoney) for (const n of MONEY_MILESTONES) if (saved >= n) reached.add(moneyKeyOf(n));
  const seenSet = new Set(seen);
  const newKeys: string[] = [];
  for (const n of DAY_MILESTONES) {
    const k = dayKeyOf(n);
    if (reached.has(k) && !seenSet.has(k)) {
      newKeys.push(k);
      days = { kind: 'days', n };
    }
  }
  for (const n of MONEY_MILESTONES) {
    const k = moneyKeyOf(n);
    if (reached.has(k) && !seenSet.has(k)) {
      newKeys.push(k);
      money = { kind: 'money', n };
    }
  }
  const keep = [...seen.filter((k) => reached.has(k)), ...newKeys];
  return { keep, newKeys, celebrate: days ?? money, changed: newKeys.length > 0 || keep.length !== seen.length };
}

/** «Verlangen überstanden» über alle Gewohnheiten. */
export function detectBadges(cravings: number, seen: string[]): { newKeys: string[]; celebrate: Celebration | null } {
  const set = new Set(seen);
  const newKeys: string[] = [];
  let celebrate: Celebration | null = null;
  for (const n of CRAVING_BADGES) {
    if (cravings >= n && !set.has(`c${n}`)) {
      newKeys.push(`c${n}`);
      celebrate = { kind: 'craving', n };
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

/** Alle Meilensteine zum Anzeigen. Tage zählen die beste Serie. */
export function badgeList(input: { bestDays: number; saved: number; cravings: number; hasMoney: boolean }): Badge[] {
  const out: Badge[] = DAY_MILESTONES.map((n) => ({ key: `d${n}`, kind: 'days' as const, n, reached: input.bestDays >= n }));
  if (input.hasMoney) out.push(...MONEY_MILESTONES.map((n) => ({ key: `m${n}`, kind: 'money' as const, n, reached: input.saved >= n })));
  out.push(...CRAVING_BADGES.map((n) => ({ key: `c${n}`, kind: 'craving' as const, n, reached: input.cravings >= n })));
  return out;
}

/**
 * Alte Schlüssel umrechnen: v2 «t<ms>@serie», v3/v4 «d<n>@serie». Neu nur noch «d<n>», «m<n>», «c1».
 * Trainings-Abzeichen und CHF 1000 gibt es nicht mehr.
 */
export function migrateSeenKeys(keys: string[]): string[] {
  const D = 86_400_000;
  const out = new Set<string>();
  for (const k of keys) {
    const t = /^t(\d+)@/.exec(k);
    if (t) {
      for (const n of DAY_MILESTONES) if (Number(t[1]) >= n * D) out.add(dayKeyOf(n));
      continue;
    }
    const d = /^d(\d+)(@.*)?$/.exec(k);
    if (d && DAY_MILESTONES.includes(Number(d[1]))) out.add(dayKeyOf(Number(d[1])));
    else if (/^m(10|50|100|500)$/.test(k) || k === 'c1') out.add(k);
  }
  return [...out];
}
