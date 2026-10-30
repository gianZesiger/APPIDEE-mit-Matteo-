import { clampSportGoal } from './limits';
import { migrateSeenKeys } from './milestones';
import { dayKey } from './time';
import { templateByKey } from './templates';

/** Version der gespeicherten Daten. Bei jeder Änderung am Format erhöhen und unten migrieren. */
export const PERSIST_VERSION = 5;

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
  'lastBackup',
  'backupSnoozed',
  'installHintSeen',
] as const;

const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/**
 * Bringt gespeicherte Daten älterer Versionen auf den aktuellen Stand.
 * v1 (Zip-Stand): kein Verlangen-Protokoll, Wochenziel bis 1200 Minuten.
 * v2: Meilensteine in Stunden («t<ms>@serie»), keine Wenn-dann-Pläne, kein Wochenrückblick.
 * v3: Schalter «Effekte reduzieren» statt Effektstufe.
 * v4: Menge und Preis direkt an der Gewohnheit, Check-in pro Gewohnheit, «Kurz bewegen» als Training,
 *     Meilensteine pro Serie («d<n>@serie»), «Stufe verlängern» als Zähler.
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
  if (version < 5) {
    p.goals = arr(p.goals).map(migrateGoal);
    p.checkins = mergeCheckins(arr(p.checkins));
    const moved = splitCravingMoves(arr(p.workouts), arr(p.cravings));
    p.workouts = moved.workouts;
    p.cravings = moved.cravings;
    const seen = typeof p.seenMilestones === 'object' && p.seenMilestones !== null ? (p.seenMilestones as Record<string, unknown>) : {};
    p.seenMilestones = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, migrateSeenKeys(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])]));
  }
  // Unbekannte Felder nie übernehmen
  const out: Record<string, unknown> = {};
  for (const k of PERSISTED_KEYS) if (k in p) out[k] = p[k];
  for (const k of ['goals', 'events', 'checkins', 'savings', 'workouts', 'cravings', 'plans']) out[k] = arr(out[k]);
  return out;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Gewohnheit aus v4 (perDay, price, planExtraWeeks) ins neue Format (rates, planExtensions, unitOne). */
export function migrateGoal(raw: unknown): unknown {
  if (!isObj(raw) || Array.isArray(raw.rates)) return raw;
  const g = { ...raw };
  const start = typeof g.startAt === 'string' && !Number.isNaN(Date.parse(g.startAt)) ? dayKey(new Date(g.startAt)) : dayKey(new Date());
  g.rates = [{ validFrom: start, perDay: numOr(g.perDay, 0), price: numOr(g.price, 0) }];
  // Verlängerungen galten früher ab Beginn: gleichwertig sind Verlängerungen am Starttag
  const extra = Math.max(0, Math.min(52, Math.round(numOr(g.planExtraWeeks, 0))));
  if (extra > 0) g.planExtensions = Array.from({ length: extra }, () => start);
  if (typeof g.templateKey === 'string' && !g.unitOne) {
    const one = templateByKey(g.templateKey).unitOne;
    if (one && g.unit === templateByKey(g.templateKey).unit) g.unitOne = one;
  }
  delete g.perDay;
  delete g.price;
  delete g.planExtraWeeks;
  return g;
}

/** Check-ins pro Tag zusammenführen: die letzte Stimmung zählt, Notizen bleiben alle erhalten. */
export function mergeCheckins(list: unknown[]): unknown[] {
  const byDay = new Map<string, Obj>();
  for (const c of list) {
    if (!isObj(c) || typeof c.day !== 'string') continue;
    const prev = byDay.get(c.day);
    const notes = [prev?.note, c.note].filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    const note = [...new Set(notes)].join(' · ').slice(0, 200) || undefined;
    const { goalId: _drop, ...rest } = c;
    void _drop;
    byDay.set(c.day, { ...rest, note });
  }
  return [...byDay.values()];
}

/** Früher legte «Kurz bewegen» ein Training an. Jetzt zählt es als «Verlangen überstanden». */
export function splitCravingMoves(workouts: unknown[], cravings: unknown[]): { workouts: unknown[]; cravings: unknown[] } {
  const out = [...cravings];
  const times = cravings.filter(isObj).map((c) => Date.parse(String(c.at)));
  const keep: unknown[] = [];
  for (const w of workouts) {
    if (!isObj(w) || w.trigger !== 'craving') {
      keep.push(w);
      continue;
    }
    const at = Date.parse(String(w.at ?? `${String(w.day)}T12:00:00`));
    // Schon als Verlangen erfasst (innerhalb von 15 Minuten)? Dann nicht doppelt.
    if (!Number.isNaN(at) && !times.some((t) => Math.abs(t - at) < 15 * 60_000)) out.push({ id: `mv-${String(w.id)}`, at: new Date(at).toISOString() });
  }
  return { workouts: keep, cravings: out };
}
