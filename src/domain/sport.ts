import { addDays, dayKey, daysBetween, parseDayKey } from './time';

export interface SportType {
  key: string;
  name: string;
  emoji: string;
  distance?: boolean; // Distanz sinnvoll
  steps?: boolean;
}

export const SPORTS: SportType[] = [
  { key: 'laufen', name: 'Laufen', emoji: '🏃', distance: true },
  { key: 'velo', name: 'Velo', emoji: '🚴', distance: true },
  { key: 'wandern', name: 'Wandern', emoji: '🥾', distance: true },
  { key: 'gehen', name: 'Spazieren', emoji: '🚶', distance: true },
  { key: 'schwimmen', name: 'Schwimmen', emoji: '🏊', distance: true },
  { key: 'kraft', name: 'Kraft', emoji: '🏋️' },
  { key: 'fussball', name: 'Fussball', emoji: '⚽' },
  { key: 'unihockey', name: 'Unihockey', emoji: '🏑' },
  { key: 'ski', name: 'Ski/Board', emoji: '⛷️' },
  { key: 'langlauf', name: 'Langlauf', emoji: '🎿', distance: true },
  { key: 'klettern', name: 'Bouldern', emoji: '🧗' },
  { key: 'yoga', name: 'Yoga', emoji: '🧘' },
  { key: 'bewegung', name: 'Kurz bewegt', emoji: '🌿' },
  { key: 'andere', name: 'Anderes', emoji: '✨' },
];

export function sportByKey(k: string): SportType {
  return SPORTS.find((s) => s.key === k) ?? SPORTS[SPORTS.length - 1];
}

export interface Workout {
  id: string;
  day: string; // YYYY-MM-DD
  at: string; // ISO
  sport: string;
  minutes: number;
  distanceKm?: number;
  rpe?: number; // Anstrengung 1-10
  feeling?: 1 | 2 | 3 | 4; // danach: leer, okay, gut, stark
  rest?: boolean; // bewusster Ruhetag, zählt positiv
  trigger?: 'craving';
  note?: string;
}

/** Montag der Woche (ISO-Woche), als Tages-Schlüssel. */
export function weekStart(day: string): string {
  const p = parseDayKey(day);
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); // 0=So
  const back = (wd + 6) % 7;
  return addDays(day, -back);
}

export interface WeekSum {
  start: string;
  minutes: number;
  sessions: number;
  activeDays: number;
  restDays: number;
  reached: boolean;
}

export function weekSums(workouts: Workout[], today: string, weeks: number, goalMin: number): WeekSum[] {
  const cur = weekStart(today);
  const out: WeekSum[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(cur, -7 * i);
    const end = addDays(start, 6);
    const all = workouts.filter((w) => w.day >= start && w.day <= end);
    const ws = all.filter((w) => !w.rest);
    const minutes = ws.reduce((s, w) => s + w.minutes, 0);
    out.push({
      start,
      minutes,
      sessions: ws.length,
      activeDays: new Set(ws.map((w) => w.day)).size,
      restDays: new Set(all.filter((w) => w.rest).map((w) => w.day)).size,
      reached: minutes >= goalMin,
    });
  }
  return out;
}

/** Serie in Wochen: aufeinanderfolgende Wochen mit erreichtem Ziel. Die laufende Woche zählt nur, wenn schon erreicht. */
export function weekStreak(workouts: Workout[], today: string, goalMin: number): number {
  const sums = weekSums(workouts, today, 104, goalMin);
  let n = 0;
  for (let i = sums.length - 1; i >= 0; i--) {
    const isCurrent = i === sums.length - 1;
    if (sums[i].reached) n++;
    else if (isCurrent) continue;
    else break;
  }
  return n;
}

/** Rollendes Fenster der letzten n Tage (heute eingeschlossen). */
export function lastDays(entries: Workout[], today: string, n = 7) {
  const from = addDays(today, -(n - 1));
  const inRange = entries.filter((w) => w.day >= from && w.day <= today);
  const ws = inRange.filter((w) => !w.rest);
  return {
    minutes: ws.reduce((s, w) => s + w.minutes, 0),
    activeDays: new Set(ws.map((w) => w.day)).size,
    restDays: new Set(inRange.filter((w) => w.rest).map((w) => w.day)).size,
    days: Array.from({ length: n }, (_, i) => addDays(from, i)),
  };
}

/** Anstrengung in drei Stufen. Gespeichert wird weiter rpe (1 bis 10), damit alte Sicherungen passen. */
export const EFFORT_RPE: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 8 };
export function effortOf(rpe?: number): 1 | 2 | 3 | undefined {
  if (!rpe) return undefined;
  return rpe <= 4 ? 1 : rpe <= 6 ? 2 : 3;
}

export function isMonday(day: string): boolean {
  const p = parseDayKey(day);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() === 1;
}

export interface SportStats {
  weekMinutes: number;
  weekSessions: number;
  weekActiveDays: number;
  weekRestDays: number;
  todayMinutes: number;
  cravingMoves: number;
  weekProgress: number;
  weekStreak: number;
  totalMinutes: number;
  totalSessions: number;
  totalKm: number;
  longest: Workout | null;
  bestWeek: number;
  favorite: string | null;
  sinceQuit: number; // Trainings seit dem frühesten Aufhör-Start
  last8: WeekSum[];
  daysSinceLast: number | null;
  last7: ReturnType<typeof lastDays>;
  lastWeekMinutes: number;
  lastWeekReached: boolean;
}

export function sportStats(allEntries: Workout[], now: Date, goalMin: number, quitStart?: string): SportStats {
  const today = dayKey(now);
  const workouts = allEntries.filter((w) => !w.rest);
  const last8 = weekSums(allEntries, today, 8, goalMin);
  const cur = last8[last8.length - 1];
  const all = weekSums(workouts, today, 104, goalMin);
  const counts = new Map<string, number>();
  for (const w of workouts) counts.set(w.sport, (counts.get(w.sport) ?? 0) + 1);
  const favorite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const longest = workouts.reduce<Workout | null>((m, w) => (!m || w.minutes > m.minutes ? w : m), null);
  const lastDay = workouts.map((w) => w.day).sort().pop();
  return {
    weekMinutes: cur.minutes,
    weekSessions: cur.sessions,
    weekActiveDays: cur.activeDays,
    weekRestDays: cur.restDays,
    todayMinutes: workouts.filter((w) => w.day === today).reduce((x, w) => x + w.minutes, 0),
    cravingMoves: workouts.filter((w) => w.trigger === 'craving').length,
    weekProgress: goalMin > 0 ? cur.minutes / goalMin : 0,
    weekStreak: weekStreak(workouts, today, goalMin),
    totalMinutes: workouts.reduce((s, w) => s + w.minutes, 0),
    totalSessions: workouts.length,
    totalKm: workouts.reduce((s, w) => s + (w.distanceKm ?? 0), 0),
    longest,
    bestWeek: Math.max(0, ...all.map((w) => w.minutes)),
    favorite,
    sinceQuit: quitStart ? workouts.filter((w) => w.day >= quitStart).length : 0,
    last8,
    daysSinceLast: lastDay ? daysBetween(lastDay, today) : null,
    last7: lastDays(allEntries, today, 7),
    lastWeekMinutes: last8[6].minutes,
    lastWeekReached: last8[6].reached,
  };
}
