import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { get, createStore } from 'idb-keyval';
import { STORAGE_KEY, useStore } from './store';
import { migratePersisted, PERSIST_VERSION } from '../domain/persist';
import { validateImport } from '../domain/backup';

const idb = createStore('weniger', 'daten');
const saved = async () => {
  const raw = await get<string>(STORAGE_KEY, idb);
  return raw ? JSON.parse(raw) : null;
};
const tick = () => new Promise((r) => setTimeout(r, 20));

const goal = (name = 'Mate') => ({
  templateKey: 'mate',
  name,
  emoji: '🧉',
  unit: 'Mate',
  perDay: 1,
  price: 1.9,
  mode: 'quit' as const,
  startAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
});

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
  it('entfernt Einträge, Check-ins und Meilensteine der Gewohnheit, andere bleiben', () => {
    const a = useStore.getState().addGoal(goal('A'));
    const b = useStore.getState().addGoal(goal('B'));
    const st = useStore.getState();
    st.addEvent({ goalId: a, at: new Date().toISOString(), units: 1, kind: 'slip' });
    st.addEvent({ goalId: b, at: new Date().toISOString(), units: 1, kind: 'slip' });
    st.checkIn(a, 2);
    st.checkIn(b, 3);
    st.markMilestones(a, ['t1']);
    st.markMilestones(b, ['t1']);
    useStore.getState().setActive(a);
    useStore.getState().removeGoal(a);
    const s = useStore.getState();
    expect(s.goals.map((g) => g.id)).toEqual([b]);
    expect(s.events.every((e) => e.goalId === b)).toBe(true);
    expect(s.checkins.every((c) => c.goalId === b)).toBe(true);
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
    expect((m.seenMilestones as Record<string, string[]>).g1.sort()).toEqual(['d1@start', 'd7@start', 'm50']);
  });
  it('Version 3: Schalter «Effekte reduzieren» wird zur Effektstufe', () => {
    expect(migratePersisted({ ...base, reduceEffects: true }, 3).fxLevel).toBe('tief');
    expect(migratePersisted({ ...base, reduceEffects: false }, 3).fxLevel).toBe('auto');
  });
  it('Version 4 (aktuell) bleibt unverändert', () => {
    const v4 = { ...base, cravings: [], plans: [{ id: 'p', when: 'Wenn', then: 'dann' }], weeklyReview: false, reviewSeen: '2026-10-19', fxLevel: 'mittel', seenMilestones: { g1: ['d1@start'] } };
    expect(migratePersisted(v4, 4)).toMatchObject(v4);
    expect(PERSIST_VERSION).toBe(4);
  });
});

describe('Tagebuch und Pläne', () => {
  it('Notiz gehört zum heutigen Check-in und bleibt beim Wechsel der Stimmung', () => {
    const a = useStore.getState().addGoal(goal());
    useStore.getState().checkIn(a, 2);
    useStore.getState().setNote(a, '  Spaziergang half.  ');
    useStore.getState().checkIn(a, 3);
    const c = useStore.getState().checkins.find((x) => x.goalId === a);
    expect(c?.mood).toBe(3);
    expect(c?.note).toBe('Spaziergang half.');
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
        { id: 'g1', name: 'x'.repeat(61), unit: 'Mal', perDay: 1, price: 1, mode: 'quit', startAt: new Date().toISOString() },
        { id: 'g2', name: 'Kaffee', unit: 'Tassen', perDay: 3, price: 1.2, mode: 'reduce', startAt: new Date().toISOString(), why: 'w'.repeat(500) },
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
