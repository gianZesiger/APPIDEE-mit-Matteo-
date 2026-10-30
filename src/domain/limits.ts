// Grenzen und Sicherungsformat ohne zod: wird beim Start gebraucht.
// Die genaue Prüfung beim Import (backup.ts, mit zod) wird erst bei Bedarf geladen.
import type { CheckIn, CravingEntry, Goal, IfThenPlan, SavingsGoal, UseEvent } from './types';
import type { Workout } from './sport';

export interface BackupSettings {
  sportGoalMin: number;
  fxLevel: string;
  weeklyReview: boolean;
}

/** Alles, was in einer Sicherung steckt: Daten, Einstellungen und gefeierte Meilensteine. */
export interface BackupData {
  goals: Goal[];
  events: UseEvent[];
  checkins: CheckIn[];
  savings: SavingsGoal[];
  workouts: Workout[];
  cravings: CravingEntry[];
  plans: IfThenPlan[];
  seenMilestones: Record<string, string[]>;
  settings: BackupSettings;
}

/** Format der Sicherungsdatei. Ältere Versionen werden beim Laden umgerechnet. */
export const BACKUP_VERSION = 5;
export const MAX_IMPORT_BYTES = 2_000_000;
export const SPORT_GOAL_MIN = 30;
export const SPORT_GOAL_MAX = 600;

export function clampSportGoal(m: unknown): number {
  const n = typeof m === 'number' && Number.isFinite(m) ? Math.round(m) : 150;
  return Math.max(SPORT_GOAL_MIN, Math.min(SPORT_GOAL_MAX, n));
}

export function serializeBackup(data: BackupData, now = new Date()): string {
  return JSON.stringify({ app: 'weniger', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data }, null, 2);
}
