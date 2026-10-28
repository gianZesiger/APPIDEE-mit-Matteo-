import type { Goal, UseEvent } from './types';
import { addDays, dayKey, daysBetween, fractionOfDay } from './time';
import { limitForDay } from './reduction';

export interface DayResult {
  day: string;
  units: number;
  limit: number;
  win: boolean;
  today: boolean;
}

export interface Stats {
  elapsedMs: number; // seit Start
  cleanMs: number; // seit Start oder letztem Ausrutscher
  winDays: number; // gute Tage insgesamt, nie zurückgesetzt
  totalDays: number; // abgeschlossene Tage
  streak: number; // aktuelle Serie (abgeschlossene Tage)
  bestStreak: number;
  saved: number; // CHF, live
  avoided: number; // Einheiten, live
  todayUnits: number;
  todayLimit: number;
  days: DayResult[];
}

export function unitsByDay(events: UseEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(e.at));
    m.set(k, (m.get(k) ?? 0) + e.units);
  }
  return m;
}

export function computeStats(goal: Goal, allEvents: UseEvent[], now: Date): Stats {
  // Nur Einträge bis «now»: so stimmen auch Rückblicke auf frühere Zeitpunkte
  const nowMs = now.getTime();
  const events = allEvents.filter((e) => e.goalId === goal.id && new Date(e.at).getTime() <= nowMs).sort((a, b) => a.at.localeCompare(b.at));
  const start = new Date(goal.startAt);
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const startDay = dayKey(start);
  const today = dayKey(now);
  const byDay = unitsByDay(events.filter((e) => new Date(e.at) >= start));

  const days: DayResult[] = [];
  const rawDays = daysBetween(startDay, today);
  const nDays = rawDays < 0 ? -1 : rawDays;
  let winDays = 0;
  let streak = 0;
  let best = 0;
  let run = 0;
  for (let i = 0; i <= nDays; i++) {
    const d = addDays(startDay, i);
    const units = byDay.get(d) ?? 0;
    const limit = goal.mode === 'reduce' ? limitForDay(goal, d) : 0;
    const isToday = d === today;
    const win = goal.mode === 'reduce' ? units <= limit : units === 0;
    days.push({ day: d, units, limit, win, today: isToday });
    if (isToday) continue;
    if (win) {
      winDays++;
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  const todayEntry = days.find((d) => d.today);
  streak = todayEntry && !todayEntry.win ? 0 : run;
  const totalDays = Math.max(0, nDays);

  // Ersparnis: erwarteter Konsum ohne App minus tatsächlicher Konsum.
  let expectedUnits: number;
  if (elapsedMs === 0) {
    expectedUnits = 0;
  } else {
    expectedUnits = goal.perDay * (elapsedMs / 86_400_000);
  }
  const usedUnits = events.filter((e) => new Date(e.at) >= start).reduce((s, e) => s + e.units, 0);

  // Im Reduktionsmodus zählt am laufenden Tag nur, was schon "fällig" gewesen wäre.
  let avoided = Math.max(0, expectedUnits - usedUnits);
  if (goal.mode === 'reduce') {
    let sum = 0;
    for (const d of days) {
      if (d.today) {
        const frac = d.day === startDay ? Math.max(0, (now.getTime() - start.getTime()) / 86_400_000) : fractionOfDay(now);
        sum += Math.max(0, goal.perDay * Math.min(1, frac) - d.units);
      } else if (d.day === startDay) {
        const firstFrac = 1 - fractionOfDay(start);
        sum += Math.max(0, goal.perDay * firstFrac - d.units);
      } else {
        sum += Math.max(0, goal.perDay - d.units);
      }
    }
    avoided = sum;
  }

  const lastSlip = [...events].reverse().find((e) => e.kind === 'slip');
  const cleanFrom = goal.mode === 'quit' && lastSlip ? new Date(lastSlip.at) : start;
  const cleanMs = Math.max(0, now.getTime() - cleanFrom.getTime());

  const todayRow = days.find((d) => d.today);
  return {
    elapsedMs,
    cleanMs,
    winDays,
    totalDays,
    streak,
    bestStreak: best,
    saved: avoided * goal.price,
    avoided,
    todayUnits: todayRow?.units ?? 0,
    todayLimit: todayRow?.limit ?? 0,
    days,
  };
}

/** Jahresprojektion für den Aha-Moment. */
export function yearly(perDay: number, price: number) {
  return { units: perDay * 365, chf: perDay * price * 365 };
}
