import { z } from 'zod';
import type { Goal, UseEvent } from './types';
import { clampSportGoal, MAX_IMPORT_BYTES, type BackupData } from './limits';

export { clampSportGoal, MAX_IMPORT_BYTES, serializeBackup, SPORT_GOAL_MAX, SPORT_GOAL_MIN, type BackupData } from './limits';
import { SPORTS, type Workout } from './sport';
import { addDays, dayKey, daysBetween } from './time';
import { app } from '../i18n/de-CH';

const E = app.profil.importErrors;

export type ImportResult = { ok: true; data: BackupData; dropped: number } | { ok: false; error: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPORT_KEYS = SPORTS.map((s) => s.key) as [string, ...string[]];

/**
 * zod-Schemas für jeden Datensatz. `now` grenzt Zeitpunkte ein: nicht mehr als einen Tag
 * in der Zukunft, nicht älter als 5 Jahre. Optionale Felder, die ungültig sind, fallen weg
 * statt den ganzen Eintrag zu verwerfen.
 */
function schemas(now: Date, goalIds: Set<string>) {
  const text = (max: number) => z.string().trim().min(1).max(max);
  const optText = (max: number) => text(max).optional().catch(undefined);
  const optNum = (min: number, max: number) => z.number().finite().min(min).max(max).optional().catch(undefined);
  const optInt = (min: number, max: number) => z.number().int().min(min).max(max).optional().catch(undefined);
  const id = z.string().min(1).max(100);
  const iso = z
    .string()
    .refine((v) => {
      const t = Date.parse(v);
      return !Number.isNaN(t) && t <= now.getTime() + 86_400_000 && t >= now.getTime() - 5 * 365 * 86_400_000;
    })
    .transform((v) => new Date(Date.parse(v)).toISOString());
  const optIso = iso.optional().catch(undefined);
  const day = z.string().refine((v) => {
    if (!DAY_RE.test(v) || addDays(v, 0) !== v) return false; // 31.2. fällt auf
    const d = daysBetween(v, dayKey(now));
    return d >= -1 && d <= 5 * 365;
  });
  const ownGoal = id.refine((g) => goalIds.has(g));

  const goal = z
    .object({
      id,
      templateKey: optText(30),
      name: text(60),
      emoji: optText(16),
      unit: optText(30),
      perDay: z.number().finite().min(0).max(500),
      price: z.number().finite().min(0).max(500),
      sugarG: optNum(0, 1000),
      caffeineMg: optNum(0, 2000),
      mode: z.enum(['quit', 'reduce']),
      startAt: iso,
      targetPerDay: optNum(0, 500),
      planWeeks: optInt(1, 52),
      planExtraWeeks: optInt(0, 52),
      why: optText(200),
      challengeDays: optInt(1, 365),
      createdAt: optIso,
      updatedAt: optIso,
    })
    .transform(
      (g): Goal => ({
        ...g,
        templateKey: g.templateKey ?? 'eigene',
        emoji: g.emoji ?? '✨',
        unit: g.unit ?? 'Mal',
        targetPerDay: g.targetPerDay !== undefined && g.targetPerDay <= g.perDay ? g.targetPerDay : undefined,
        createdAt: g.createdAt ?? g.startAt,
        updatedAt: g.updatedAt ?? new Date().toISOString(),
      }),
    );

  const event = z
    .object({ id, goalId: ownGoal, at: iso, units: z.number().finite().min(0).max(500), kind: z.enum(['slip', 'log']), trigger: optText(40), updatedAt: optIso })
    .transform((e): UseEvent => ({ ...e, updatedAt: e.updatedAt ?? e.at }));

  const checkin = z.object({ id, goalId: ownGoal, day, mood: z.union([z.literal(1), z.literal(2), z.literal(3)]), note: optText(200) });

  const saving = z.object({ id, name: text(60), amount: z.number().finite().min(1).max(1_000_000) });

  const workout = z
    .object({
      id,
      day,
      at: optIso,
      sport: z.enum(SPORT_KEYS),
      rest: z.boolean().optional().catch(undefined),
      minutes: z.number().finite().min(0).max(1440),
      distanceKm: optNum(0.01, 1000),
      rpe: optInt(1, 10),
      feeling: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().catch(undefined),
      trigger: z.literal('craving').optional().catch(undefined),
      note: optText(200),
    })
    .refine((w) => w.rest === true || w.minutes >= 1)
    .transform(
      (w): Workout => ({
        ...w,
        at: w.at ?? `${w.day}T12:00:00.000Z`,
        rest: w.rest === true ? true : undefined,
        minutes: w.rest === true ? 0 : Math.round(w.minutes),
      }),
    );

  const craving = z.object({ id, at: iso, level: z.number().int().min(1).max(5) });

  const plan = z.object({ id, when: text(60), then: text(120) });

  return { goal, event, checkin, saving, workout, craving, plan };
}

/** Nimmt nur gültige Einträge (ohne doppelte IDs) und zählt verworfene. */
function keep<T extends { id: string }>(list: unknown, schema: z.ZodType<T>): { items: T[]; dropped: number } {
  if (!Array.isArray(list)) return { items: [], dropped: 0 };
  const items: T[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    const r = schema.safeParse(x);
    if (r.success && !seen.has(r.data.id)) {
      seen.add(r.data.id);
      items.push(r.data);
    }
  }
  return { items, dropped: list.length - items.length };
}

/**
 * Prüft eine Sicherung Feld für Feld. Ungültige Einträge werden verworfen,
 * eine Sicherung ohne gültiges Ziel wird abgelehnt. Grösse höchstens 2 MB.
 */
export function validateImport(json: string, now = new Date()): ImportResult {
  if (new TextEncoder().encode(json).length > MAX_IMPORT_BYTES) return { ok: false, error: E.tooBig };
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return { ok: false, error: E.invalid };
  }
  const root = z.object({ goals: z.array(z.unknown()) }).passthrough().safeParse(d);
  if (!root.success) return { ok: false, error: E.foreign };
  const raw = root.data as Record<string, unknown>;

  const goals = keep(raw.goals, schemas(now, new Set()).goal);
  if (goals.items.length === 0) return { ok: false, error: E.noHabit };
  const s = schemas(now, new Set(goals.items.map((g) => g.id)));
  const events = keep(raw.events, s.event);
  const checkins = keep(raw.checkins, s.checkin);
  const savings = keep(raw.savings, s.saving);
  const workouts = keep(raw.workouts, s.workout);
  const cravings = keep(raw.cravings, s.craving);
  const plans = keep(raw.plans, s.plan);
  const dropped = [goals, events, checkins, savings, workouts, cravings, plans].reduce((n, x) => n + x.dropped, 0);
  return {
    ok: true,
    dropped,
    data: {
      goals: goals.items,
      events: events.items,
      checkins: checkins.items,
      savings: savings.items,
      workouts: workouts.items,
      cravings: cravings.items,
      plans: plans.items,
      sportGoalMin: clampSportGoal(raw.sportGoalMin),
    },
  };
}
