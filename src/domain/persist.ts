import { clampSportGoal } from './limits';
import { migrateSeenKeys } from './milestones';

/** Version der gespeicherten Daten. Bei jeder Änderung am Format erhöhen und unten migrieren. */
export const PERSIST_VERSION = 4;

/** Nur diese Felder werden gespeichert (Nutzerdaten, keine Funktionen oder Zwischenzustände). */
export const PERSISTED_KEYS = [
  'goals',
  'events',
  'checkins',
  'savings',
  'workouts',
  'cravings',
  'plans',
  'activeGoalId',
  'seenMilestones',
  'adultConfirmed',
  'sportGoalMin',
  'fxLevel',
  'weeklyReview',
  'reviewSeen',
] as const;

const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/**
 * Bringt gespeicherte Daten älterer Versionen auf den aktuellen Stand.
 * v1 (Zip-Stand): kein Verlangen-Protokoll, Wochenziel bis 1200 Minuten.
 * v2: Meilensteine in Stunden («t<ms>@serie»), keine Wenn-dann-Pläne, kein Wochenrückblick.
 * v3: Schalter «Effekte reduzieren» statt Effektstufe.
 */
export function migratePersisted(persisted: unknown, version: number): Record<string, unknown> {
  const p: Record<string, unknown> = typeof persisted === 'object' && persisted !== null ? { ...(persisted as Record<string, unknown>) } : {};
  if (version < 2) {
    p.cravings = arr(p.cravings);
    p.sportGoalMin = clampSportGoal(p.sportGoalMin);
  }
  if (version < 3) {
    const seen = typeof p.seenMilestones === 'object' && p.seenMilestones !== null ? (p.seenMilestones as Record<string, unknown>) : {};
    p.seenMilestones = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, migrateSeenKeys(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])]));
    p.plans = arr(p.plans);
    p.weeklyReview = true;
  }
  if (version < 4) {
    p.fxLevel = p.reduceEffects === true ? 'tief' : 'auto';
  }
  // Unbekannte Felder nie übernehmen
  const out: Record<string, unknown> = {};
  for (const k of PERSISTED_KEYS) if (k in p) out[k] = p[k];
  for (const k of ['goals', 'events', 'checkins', 'savings', 'workouts', 'cravings', 'plans']) out[k] = arr(out[k]);
  return out;
}
