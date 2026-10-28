// Grenzen und Sicherungsformat ohne zod: wird beim Start gebraucht.
// Die genaue Prüfung beim Import (backup.ts, mit zod) wird erst bei Bedarf geladen.
import type { CheckIn, CravingEntry, Goal, IfThenPlan, SavingsGoal, UseEvent } from './types';
import type { Workout } from './sport';

/** Alles, was in einer Sicherung steckt (nur Nutzerdaten). */
export interface BackupData {
  goals: Goal[];
  events: UseEvent[];
  checkins: CheckIn[];
  savings: SavingsGoal[];
  workouts: Workout[];
  cravings: CravingEntry[];
  plans: IfThenPlan[];
  sportGoalMin: number;
}

export const MAX_IMPORT_BYTES = 2_000_000;
export const SPORT_GOAL_MIN = 30;
export const SPORT_GOAL_MAX = 600;

export function clampSportGoal(m: unknown): number {
  const n = typeof m === 'number' && Number.isFinite(m) ? Math.round(m) : 150;
  return Math.max(SPORT_GOAL_MIN, Math.min(SPORT_GOAL_MAX, n));
}

export function serializeBackup(data: BackupData, now = new Date()): string {
  return JSON.stringify({ app: 'weniger-solo', version: 3, exportedAt: now.toISOString(), ...data }, null, 2);
}
