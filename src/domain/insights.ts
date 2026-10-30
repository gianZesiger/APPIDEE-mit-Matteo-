// Private Auswertungen: Muster, Wenn-dann-Vorschläge, Wochenrückblick, Teilen-Inhalt, Challenge-Links.
// Nichts davon verlässt das Gerät, ausser die Person teilt bewusst eine Karte oder einen Link.
import type { CravingEntry, Goal, UseEvent } from './types';
import type { Workout } from './sport';
import { weekSums, weekStart } from './sport';
import { dayStart, goalSummary, roundRappen, totalSaved } from './stats';
import { addDays, dayKey } from './time';

// ---------- Muster aus Ausrutschern und Verlangen ----------

export type DayPart = 'morgen' | 'mittag' | 'nachmittag' | 'abend' | 'nacht';

export function dayPart(d: Date): DayPart {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morgen';
  if (h >= 11 && h < 14) return 'mittag';
  if (h >= 14 && h < 18) return 'nachmittag';
  if (h >= 18 && h < 23) return 'abend';
  return 'nacht';
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayMon(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export interface Patterns {
  total: number;
  triggers: { name: string; count: number }[];
  parts: { part: DayPart; count: number }[];
  weekdays: number[]; // Anzahl pro Wochentag, Montag zuerst
  topWeekday: number | null;
}

/** Ab wie vielen Einträgen ein Muster angezeigt wird. */
export const MIN_PATTERN_ENTRIES = 3;

export function patterns(events: UseEvent[], cravings: CravingEntry[]): Patterns {
  const slips = events.filter((e) => e.kind === 'slip');
  const moments = [...slips.map((e) => new Date(e.at)), ...cravings.map((c) => new Date(c.at))];
  const trig = new Map<string, number>();
  for (const e of slips) if (e.trigger) trig.set(e.trigger, (trig.get(e.trigger) ?? 0) + 1);
  const parts = new Map<DayPart, number>();
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  for (const d of moments) {
    parts.set(dayPart(d), (parts.get(dayPart(d)) ?? 0) + 1);
    weekdays[weekdayMon(d)]++;
  }
  const max = Math.max(...weekdays);
  return {
    total: moments.length,
    triggers: [...trig.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    parts: [...parts.entries()].map(([part, count]) => ({ part, count })).sort((a, b) => b.count - a.count),
    weekdays,
    topWeekday: max > 0 && weekdays.filter((n) => n === max).length === 1 ? weekdays.indexOf(max) : null,
  };
}

/** Auslöser für Wenn-dann-Vorschläge: die häufigsten zuerst, dann die übrigen. */
export function suggestTriggers(p: Patterns, all: string[]): string[] {
  const top = p.triggers.map((t) => t.name).filter((t) => all.includes(t));
  return [...top, ...all.filter((t) => !top.includes(t))];
}

// ---------- Wochenrückblick ----------

export interface GoalWeek {
  goalId: string;
  name: string;
  mode: Goal['mode'];
  good: number; // gute Tage bzw. Tage im Plan
  of: number; // Tage dieser Woche seit dem Start
}

export interface WeekReview {
  week: string; // Montag der Woche
  perGoal: GoalWeek[];
  saved: number;
  trainingMinutes: number;
}

/** Rückblick auf die letzte abgeschlossene Kalenderwoche (Montag bis Sonntag), klar pro Gewohnheit. */
export function lastWeekReview(goals: Goal[], events: UseEvent[], workouts: Workout[], now: Date, sportGoal = 150): WeekReview | null {
  const today = dayKey(now);
  const mon = addDays(weekStart(today), -7);
  const sun = addDays(mon, 6);
  const started = goals.filter((g) => dayKey(new Date(g.startAt)) <= sun);
  if (started.length === 0) return null;
  // Ende der Woche: Montag 00:00 lokal
  const end = dayStart(addDays(sun, 1));
  const start = dayStart(mon);
  const perGoal = started.map((g) => {
    const rows = goalSummary(g, events, end).days.filter((x) => x.day >= mon && x.day <= sun);
    return { goalId: g.id, name: g.name, mode: g.mode, good: rows.filter((r) => r.win).length, of: rows.length };
  });
  const saved = totalSaved(started, events, end) - totalSaved(started, events, start);
  const minutes = weekSums(workouts, today, 2, sportGoal)[0].minutes;
  return { week: mon, perGoal, saved: Math.max(0, roundRappen(saved)), trainingMinutes: minutes };
}

// ---------- Teilen-Karte ----------

/** Was auf eine Teilen-Karte darf. Ausrutscher, Notizen und Auslöser gibt es hier gar nicht. */
export interface ShareInput {
  goodDays: number;
  habit?: string;
  amount?: number;
  showHabit: boolean;
  showAmount: boolean;
  showDays: boolean;
}

export interface ShareContent {
  days: number | null;
  habit: string | null;
  amount: number | null;
}

export function shareContent(i: ShareInput): ShareContent {
  return {
    days: i.showDays ? Math.max(0, Math.floor(i.goodDays)) : null,
    habit: i.showHabit && i.habit ? i.habit.slice(0, 40) : null,
    amount: i.showAmount && i.amount !== undefined && i.amount > 0 ? i.amount : null,
  };
}

// ---------- Challenge per Link (#challenge=mate-30), ohne Server ----------

export const CHALLENGE_DAYS = [7, 14, 30];

export function challengeHash(templateKey: string, days: number): string {
  return `#challenge=${encodeURIComponent(templateKey)}-${Math.round(days)}`;
}

export function parseChallenge(hash: string, validKeys: string[]): { templateKey: string; days: number } | null {
  // Auch die alte Kurzform #c=mate-14 von früheren Links
  const m = /^#(?:challenge|c)=([a-z]+)-(\d{1,3})$/.exec(hash.trim());
  if (!m) return null;
  const days = Number(m[2]);
  if (!validKeys.includes(m[1]) || days < 1 || days > 365) return null;
  return { templateKey: m[1], days };
}
