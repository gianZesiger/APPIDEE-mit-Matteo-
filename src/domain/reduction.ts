// Reduktionsplan: Wochenstufen von der Basis bis zum frei gewählten Ziel.
import type { Goal } from './types';
import { addDays, daysBetween } from './time';
import { baseRate, startDayOf } from './rates';

/**
 * Lineare Stufen von `start` bis `target`, gerundet auf `step`.
 * Ohne doppelte Stufen: Fallen zwei Wochen auf denselben Wert, wird der Plan kürzer.
 */
export function planSteps(start: number, target: number, weeks: number, step = 1): number[] {
  const w = Math.max(1, Math.round(weeks));
  const unit = step > 0 ? step : 1;
  const steps: number[] = [];
  for (let i = 1; i <= w; i++) {
    const v = start - ((start - target) * i) / w;
    const r = +Math.max(target, Math.round(v / unit) * unit).toFixed(2);
    if (i === w) {
      if (steps[steps.length - 1] !== target) steps.push(+target.toFixed(2));
    } else if (r < start && r > target && r !== steps[steps.length - 1]) {
      steps.push(r);
    }
  }
  return steps.length ? steps : [+target.toFixed(2)];
}

export interface Stage {
  index: number; // 0 = erste Woche
  limit: number;
  start: string; // erster Tag
  end: string | null; // erster Tag danach; null = letzte Stufe, gilt weiter
  extended: boolean;
}

/** Stufen des Plans mit Verlängerungen. Eine Verlängerung hält die Stufe, in der sie gedrückt wurde, 7 Tage länger. */
export function planStages(goal: Goal): Stage[] {
  const steps = planSteps(baseRate(goal).perDay, goal.targetPerDay ?? 0, goal.planWeeks ?? 4, baseRate(goal).perDay % 1 ? 0.5 : 1);
  const lengths = steps.map(() => 7);
  const extended = steps.map(() => false);
  const start = startDayOf(goal);
  for (const day of [...(goal.planExtensions ?? [])].sort()) {
    // In welcher Stufe lag dieser Tag (mit den bisherigen Verlängerungen)?
    let s = start;
    for (let i = 0; i < steps.length; i++) {
      const end = addDays(s, lengths[i]);
      if (day < end || i === steps.length - 1) {
        if (i < steps.length - 1) {
          lengths[i] += 7;
          extended[i] = true;
        }
        break;
      }
      s = end;
    }
  }
  const out: Stage[] = [];
  let s = start;
  steps.forEach((limit, i) => {
    const last = i === steps.length - 1;
    const end = last ? null : addDays(s, lengths[i]);
    out.push({ index: i, limit, start: s, end, extended: extended[i] });
    if (end) s = end;
  });
  return out;
}

export function stageOn(goal: Goal, day: string): Stage {
  const stages = planStages(goal);
  return stages.find((s) => s.end === null || day < s.end) ?? stages[stages.length - 1];
}

/** Tageslimit für einen bestimmten Tag. */
export function limitForDay(goal: Goal, day: string): number {
  if (goal.mode !== 'reduce') return 0;
  return stageOn(goal, day).limit;
}

/** «Stufe verlängern» geht höchstens einmal pro Woche und nie in der letzten Stufe. */
export function canExtend(goal: Goal, today: string): boolean {
  if (goal.mode !== 'reduce') return false;
  if (stageOn(goal, today).end === null) return false;
  const last = [...(goal.planExtensions ?? [])].sort().pop();
  return !last || daysBetween(last, today) >= 7;
}

export function extendStage(goal: Goal, today: string): string[] {
  return canExtend(goal, today) ? [...(goal.planExtensions ?? []), today] : (goal.planExtensions ?? []);
}
