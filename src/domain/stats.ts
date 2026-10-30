// Alle Zahlen einer Gewohnheit kommen aus goalSummary, die Summe über alle aus totalSaved.
// Keine Ansicht rechnet selbst.
//
// Regeln:
// - Ein Tag ist der lokale Kalendertag (Sommer- und Winterzeit inklusive).
// - Gut ist ein Tag ohne Ausrutscher (Aufhören) oder im Plan (Reduzieren). Heute zählt mit, solange heute gut ist.
// - Serie = gute Tage am Stück bis heute. «Seit X Tagen» zeigt dieselbe Zahl.
// - Gespart: pro Tag (Basis − Konsum) × Preis zur damaligen Rate, für Aufhören und Reduzieren gleich.
//   Der Starttag und heute zählen anteilig nach echter Zeit. Mehrkonsum zählt negativ.
import type { Goal, UseEvent } from './types';
import { addDays, dayKey, daysBetween } from './time';
import { limitForDay, planStages, stageOn } from './reduction';
import { rateOn, startDayOf } from './rates';

export interface DayResult {
  day: string;
  units: number;
  limit: number;
  win: boolean;
  today: boolean;
}

export interface PlanStatus {
  week: number; // 1 = erste Stufe
  weeks: number;
  limit: number;
  /** Letzter Tag der verlängerten Stufe, sonst null */
  extendedUntil: string | null;
  /** Tage dieser Stufe bis heute, davon im Plan */
  daysSoFar: number;
  inPlan: number;
}

export interface GoalSummary {
  streak: number; // gute Tage am Stück, heute inklusive, solange heute gut ist
  bestStreak: number; // nie kleiner als streak
  goodDays: number; // alle guten Tage, heute inklusive, solange heute gut ist
  totalDays: number; // Kalendertage seit Start, heute inklusive
  saved: number; // CHF, auf Rappen gerundet
  avoided: number; // Einheiten
  todayUnits: number;
  todayLimit: number;
  /** Seit wann ohne Ausrutscher (für die genaue Zeit mit Sekunden) */
  cleanFrom: number;
  plan: PlanStatus | null;
  days: DayResult[];
}

export const roundRappen = (v: number) => Math.round(v * 100) / 100;

function startOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Anteil eines Kalendertags zwischen zwei Zeitpunkten (nach echter Tageslänge, also 23 oder 25 Stunden bei Umstellung). */
function portion(day: string, from: Date | null, to: Date | null): number {
  const a = startOfDay(day).getTime();
  const b = startOfDay(addDays(day, 1)).getTime();
  const lo = Math.max(a, from?.getTime() ?? a);
  const hi = Math.min(b, to?.getTime() ?? b);
  return Math.max(0, (hi - lo) / (b - a));
}

export function unitsByDay(events: UseEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(e.at));
    m.set(k, (m.get(k) ?? 0) + e.units);
  }
  return m;
}

/** Die eine Funktion für alle Zahlen einer Gewohnheit zu einem Zeitpunkt. */
export function goalSummary(goal: Goal, allEvents: UseEvent[], now: Date): GoalSummary {
  const nowMs = now.getTime();
  const start = new Date(goal.startAt);
  const startDay = startDayOf(goal);
  const today = dayKey(now);
  // Nur Einträge dieser Gewohnheit, ab Start und bis jetzt
  const events = allEvents
    .filter((e) => e.goalId === goal.id && new Date(e.at).getTime() <= nowMs && new Date(e.at).getTime() >= start.getTime())
    .sort((a, b) => a.at.localeCompare(b.at));
  const byDay = unitsByDay(events);

  const n = start.getTime() > nowMs ? -1 : daysBetween(startDay, today);
  const days: DayResult[] = [];
  let goodDays = 0;
  let run = 0;
  let best = 0;
  let avoided = 0;
  let saved = 0;
  for (let i = 0; i <= n; i++) {
    const d = addDays(startDay, i);
    const units = byDay.get(d) ?? 0;
    const limit = goal.mode === 'reduce' ? limitForDay(goal, d) : 0;
    const win = goal.mode === 'reduce' ? units <= limit : units === 0;
    const isToday = d === today;
    days.push({ day: d, units, limit, win, today: isToday });
    if (win) {
      goodDays++;
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    const rate = rateOn(goal, d);
    const base = rate.perDay * portion(d, i === 0 ? start : null, isToday ? now : null);
    avoided += base - units;
    saved += (base - units) * rate.price;
  }

  const lastSlip = [...events].reverse().find((e) => e.kind === 'slip');
  const cleanFrom = goal.mode === 'quit' && lastSlip ? new Date(lastSlip.at).getTime() : start.getTime();
  const todayRow = days[days.length - 1];

  let plan: PlanStatus | null = null;
  if (goal.mode === 'reduce' && todayRow) {
    const stage = stageOn(goal, today);
    const inStage = days.filter((x) => x.day >= stage.start);
    plan = {
      week: stage.index + 1,
      weeks: planStages(goal).length,
      limit: stage.limit,
      extendedUntil: stage.extended && stage.end ? addDays(stage.end, -1) : null,
      daysSoFar: inStage.length,
      inPlan: inStage.filter((x) => x.win).length,
    };
  }

  return {
    streak: run,
    bestStreak: Math.max(best, run),
    goodDays,
    totalDays: Math.max(0, n + 1),
    saved: roundRappen(saved),
    avoided,
    todayUnits: todayRow?.today ? todayRow.units : 0,
    todayLimit: todayRow?.today ? todayRow.limit : 0,
    cleanFrom,
    plan,
    days,
  };
}


/** Insgesamt gespart: genau die Summe der (auf Rappen gerundeten) Gewohnheiten. Basis der Sparziele. */
export function totalSaved(goals: Goal[], events: UseEvent[], now: Date): number {
  return roundRappen(goals.reduce((sum, g) => sum + goalSummary(g, events, now).saved, 0));
}

/** Start eines Kalendertags als Datum (lokal). */
export const dayStart = startOfDay;

/** Jahresprojektion für den Aha-Moment. */
export function yearly(perDay: number, price: number) {
  return { units: perDay * 365, chf: perDay * price * 365 };
}

export { startDayOf };
