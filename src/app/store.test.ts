import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { get, createStore } from 'idb-keyval';
import { STORAGE_KEY, useStore } from './store';
import { migratePersisted, PERSIST_VERSION } from '../domain/persist';
import { validateImport } from '../domain/backup';
import { addDays, dayKey } from '../domain/time';
import { goalSummary } from '../domain/stats';

const idb = createStore('weniger', 'daten');
const saved = async () => {
  const raw = await get<string>(STORAGE_KEY, idb);
  return raw ? JSON.parse(raw) : null;
};
const tick = () => new Promise((r) => setTimeout(r, 20));

const goal = (name = 'Mate', mode: 'quit' | 'reduce' = 'quit') => {
  const start = new Date(Date.now() - 3 * 86_400_000);
  return {
    templateKey: 'mate',
    name,
    emoji: '🧉',
    unit: 'Mate',
    rates: [{ validFrom: dayKey(start), perDay: 2, price: 1.9 }],
    mode,
    targetPerDay: 0,
    planWeeks: 4,
    startAt: start.toISOString(),
  };
};

beforeEach(async () => {
  await useStore.persist.rehydrate();
  if (useStore.getState().demo) await useStore.getState().exitDemo();
  await useStore.getState().wipe();
  await tick();
});

describe('Speicher in IndexedDB', () => {
  it('schreibt Nutzerdaten, aber keine Funktionen oder Zwischenzustände', async () => {
    useStore.getState().addGoal(goal());
    await tick();
    const s = await saved();
    expect(s.version).toBe(PERSIST_VERSION);
    expect(s.state.goals).toHaveLength(1);
    expect('demo' in s.state).toBe(false);
    expect('saveError' in s.state).toBe(false);
    expect('addGoal' in s.state).toBe(false);
  });
});

describe('Beispiel überschreibt nie eigene Daten', () => {
  it('Beispiel läuft im Arbeitsspeicher, danach sind die eigenen Daten wieder da', async () => {
    const id = useStore.getState().addGoal(goal('Meine Mate'));
    await tick();
    useStore.getState().enterDemo();
    expect(useStore.getState().demo).toBe(true);
    expect(useStore.getState().goals.some((g) => g.id.startsWith('ex-'))).toBe(true);
    // Im Beispiel etwas ändern: wird nicht gespeichert
    useStore.getState().addGoal(goal('Beispiel-Änderung'));
    useStore.getState().addWorkout({ day: '2026-10-20', at: new Date().toISOString(), sport: 'laufen', minutes: 30 });
    await tick();
    const during = await saved();
    expect(during.state.goals.map((g: { name: string }) => g.name)).toEqual(['Meine Mate']);
    expect(during.state.workouts).toEqual([]);

    await useStore.getState().exitDemo();
    expect(useStore.getState().demo).toBe(false);
    expect(useStore.getState().goals.map((g) => g.id)).toEqual([id]);
  });

  it('«Alle Daten löschen» im Beispiel beendet nur das Beispiel', async () => {
    useStore.getState().addGoal(goal('Bleibt'));
    await tick();
    useStore.getState().enterDemo();
    await useStore.getState().wipe();
    expect(useStore.getState().goals.map((g) => g.name)).toEqual(['Bleibt']);
  });
});

describe('Gewohnheit löschen', () => {
  it('entfernt Einträge und Meilensteine der Gewohnheit, andere bleiben; der Check-in gilt für den Tag', () => {
    const a = useStore.getState().addGoal(goal('A'));
    const b = useStore.getState().addGoal(goal('B'));
    const st = useStore.getState();
    st.addEvent({ goalId: a, at: new Date().toISOString(), units: 1, kind: 'slip' });
    st.addEvent({ goalId: b, at: new Date().toISOString(), units: 1, kind: 'slip' });
    st.checkIn(2);
    st.markMilestones(a, ['t1']);
    st.markMilestones(b, ['t1']);
    useStore.getState().setActive(a);
    useStore.getState().removeGoal(a);
    const s = useStore.getState();
    expect(s.goals.map((g) => g.id)).toEqual([b]);
    expect(s.events.every((e) => e.goalId === b)).toBe(true);
    expect(s.checkins).toHaveLength(1);
    expect(s.seenMilestones[a]).toBeUndefined();
    expect(s.seenMilestones[b]).toEqual(['t1']);
    expect(s.activeGoalId).toBe(b);
  });
});

describe('Migration je Version', () => {
  const base = { goals: [], events: [], checkins: [], savings: [], workouts: [] };
  it('Version 0 (unbekannt) wird zu gültigen leeren Listen', () => {
    const m = migratePersisted(undefined, 0);
    expect(m.goals).toEqual([]);
    expect(m.cravings).toEqual([]);
  });
  it('Version 1 (Zip-Stand) bekommt Verlangen-Protokoll und gültiges Wochenziel', () => {
    const m = migratePersisted({ ...base, sportGoalMin: 900 }, 1);
    expect(m.cravings).toEqual([]);
    expect(m.sportGoalMin).toBe(600);
  });
  it('Version 2: Meilensteine in Tage umrechnen, Pläne und Wochenrückblick dazu', () => {
    const v2 = { ...base, cravings: [], sportGoalMin: 180, reduceEffects: true, seenMilestones: { g1: ['t3600000@start', 't604800000@start', 'm50', 'm1000'] } };
    const m = migratePersisted(v2, 2);
    expect(m).toMatchObject({ sportGoalMin: 180, fxLevel: 'tief', plans: [], weeklyReview: true });
    expect((m.seenMilestones as Record<string, string[]>).g1.sort()).toEqual(['d1', 'd7', 'm50']);
  });
  it('Version 3: Schalter «Effekte reduzieren» wird zur Effektstufe', () => {
    expect(migratePersisted({ ...base, reduceEffects: true }, 3).fxLevel).toBe('tief');
    expect(migratePersisted({ ...base, reduceEffects: false }, 3).fxLevel).toBe('auto');
  });
  it('Version 5 (aktuell) bleibt unverändert', () => {
    const v5 = { ...base, cravings: [], plans: [{ id: 'p', when: 'Wenn', then: 'dann' }], weeklyReview: false, reviewSeen: '2026-10-19', fxLevel: 'mittel', seenMilestones: { g1: ['d1'] } };
    expect(migratePersisted(v5, 5)).toMatchObject(v5);
    expect(PERSIST_VERSION).toBe(5);
  });
});

describe('Tagebuch und Pläne', () => {
  it('Check-in einmal pro Tag, änderbar; die Notiz bleibt beim Wechsel der Stimmung', () => {
    useStore.getState().addGoal(goal());
    useStore.getState().addGoal(goal('Kaffee'));
    useStore.getState().checkIn(2);
    useStore.getState().setNote('  Spaziergang half.  ');
    useStore.getState().checkIn(3);
    const list = useStore.getState().checkins;
    expect(list).toHaveLength(1);
    expect(list[0].mood).toBe(3);
    expect(list[0].note).toBe('Spaziergang half.');
  });
  it('Pläne werden gekürzt gespeichert und gelöscht', () => {
    useStore.getState().addPlan('Wenn ich Stress habe', 'x'.repeat(300));
    const p = useStore.getState().plans[0];
    expect(p.then).toHaveLength(120);
    useStore.getState().removePlan(p.id);
    expect(useStore.getState().plans).toEqual([]);
  });
});

describe('Import mit zod', () => {
  it('verwirft zu lange Texte', () => {
    const json = JSON.stringify({
      goals: [
        { id: 'g1', name: 'x'.repeat(61), unit: 'Mal', perDay: 1, price: 1, mode: 'quit', startAt: new Date(Date.now() - 3_600_000).toISOString() },
        { id: 'g2', name: 'Kaffee', unit: 'Tassen', perDay: 3, price: 1.2, mode: 'reduce', startAt: new Date(Date.now() - 3_600_000).toISOString(), why: 'w'.repeat(500) },
      ],
    });
    const r = validateImport(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.goals.map((g) => g.id)).toEqual(['g2']);
      expect(r.data.goals[0].why).toBeUndefined();
    }
  });
});

describe('Nachtragen, Korrigieren und Rückgängig', () => {
  it('einen Tag im Verlauf korrigieren ersetzt alle Einträge dieses Tages', () => {
    const id = useStore.getState().addGoal(goal('Kaffee', 'reduce'));
    const yesterday = addDays(dayKey(new Date()), -1);
    const st = useStore.getState();
    st.setDayUnits(id, yesterday, 3);
    st.setDayUnits(id, yesterday, 1);
    const evs = useStore.getState().events.filter((e) => e.goalId === id);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ units: 1, kind: 'log' });
    expect(dayKey(new Date(evs[0].at))).toBe(yesterday);
    useStore.getState().setDayUnits(id, yesterday, 0);
    expect(useStore.getState().events.filter((e) => e.goalId === id)).toHaveLength(0);
  });

  it('«Rückgängig» nimmt nur den letzten Eintrag von heute, ältere Tage bleiben', () => {
    const id = useStore.getState().addGoal(goal('Kaffee', 'reduce'));
    const yesterday = addDays(dayKey(new Date()), -1);
    useStore.getState().setDayUnits(id, yesterday, 2);
    useStore.getState().undoLastEvent(id);
    expect(useStore.getState().events).toHaveLength(1);
    useStore.getState().addEvent({ goalId: id, at: new Date().toISOString(), units: 1, kind: 'log' });
    useStore.getState().undoLastEvent(id);
    expect(useStore.getState().events).toHaveLength(1);
  });

  it('Preis ab heute ändern lässt die Vergangenheit stehen', () => {
    const id = useStore.getState().addGoal(goal());
    const now = new Date();
    const before = goalSummary(useStore.getState().goals[0], [], now).saved;
    useStore.getState().changeGoalRate(id, { perDay: 2, price: 50 }, false);
    const g = useStore.getState().goals[0];
    expect(g.rates).toHaveLength(2);
    expect(goalSummary(g, [], now).saved).toBeGreaterThan(before);
    // Die Tage vor heute rechnen weiter mit CHF 1.90
    const yesterdayEnd = new Date(new Date().setHours(0, 0, 0, 0));
    expect(goalSummary(g, [], yesterdayEnd).saved).toBe(goalSummary({ ...g, rates: [g.rates[0]] }, [], yesterdayEnd).saved);
  });

  it('Ruhetag und Training am selben Tag schliessen sich aus', () => {
    const day = dayKey(new Date());
    const st = useStore.getState();
    expect(st.addWorkout({ day, at: new Date().toISOString(), sport: 'andere', minutes: 0, rest: true })).toBe(true);
    expect(useStore.getState().addWorkout({ day, at: new Date().toISOString(), sport: 'laufen', minutes: 30 })).toBe(true);
    expect(useStore.getState().workouts.map((w) => w.sport)).toEqual(['laufen']);
    expect(useStore.getState().addWorkout({ day, at: new Date().toISOString(), sport: 'andere', minutes: 0, rest: true })).toBe(false);
  });
});
