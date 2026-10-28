import type { Goal } from './types';
import { daysBetween, dayKey } from './time';

/** Lineare Wochenstufen von perDay bis targetPerDay, gerundet auf ganze Einheiten. */
export function planSteps(start: number, target: number, weeks: number, step = 1): number[] {
  const w = Math.max(1, Math.round(weeks));
  const unit = step > 0 ? step : 1;
  const steps: number[] = [];
  for (let i = 1; i <= w; i++) {
    const v = start - ((start - target) * i) / w;
    let r = Math.round(v / unit) * unit;
    // Vor der letzten Woche nie schon beim Ziel landen, sonst fehlen Zwischenstufen.
    if (i < w && r <= target && start - target >= unit) r = target + unit;
    steps.push(+Math.max(target, r).toFixed(2));
  }
  return steps;
}

/** Tageslimit für einen bestimmten Tag. Woche 1 ist die erste Stufe. */
export function limitForDay(goal: Goal, day: string): number {
  if (goal.mode !== 'reduce') return 0;
  const target = goal.targetPerDay ?? 0;
  const weeks = goal.planWeeks ?? 4;
  const steps = planSteps(goal.perDay, target, weeks, goal.perDay % 1 ? 0.5 : 1);
  const startDay = dayKey(new Date(goal.startAt));
  const idx = Math.floor(Math.max(0, daysBetween(startDay, day)) / 7) - (goal.planExtraWeeks ?? 0);
  if (idx < 0) return steps[0];
  return steps[Math.min(idx, steps.length - 1)];
}

export function weekIndex(goal: Goal, day: string): number {
  const startDay = dayKey(new Date(goal.startAt));
  return Math.floor(Math.max(0, daysBetween(startDay, day)) / 7);
}
