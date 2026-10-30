import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CheckIn, CravingEntry, Goal, IfThenPlan, SavingsGoal, UseEvent } from '../domain/types';
import type { Workout } from '../domain/sport';
import { exampleData } from './example';
import { dayKey } from '../domain/time';
import { clampSportGoal, serializeBackup, type BackupData } from '../domain/limits';
import { changeRate } from '../domain/rates';
import { extendStage } from '../domain/reduction';
import { dayStart } from '../domain/stats';
import { migratePersisted, PERSIST_VERSION, PERSISTED_KEYS } from '../domain/persist';
import { movePot } from '../domain/savings';
import { GLOBAL } from '../domain/milestones';
import { app } from '../i18n/de-CH';
import { appStorage, onSaveError, requestPersistence, setStorageDemo } from './storage';
import { isChoice, type FxChoice } from '../ui/fx-level';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const STORAGE_KEY = 'weniger-solo';

export type ImportPreview = { ok: true; data: BackupData; dropped: number; goals: number; goodDays: number } | { ok: false; message: string };

interface State {
  goals: Goal[];
  events: UseEvent[];
  checkins: CheckIn[];
  savings: SavingsGoal[];
  activeGoalId: string | null;
  seenMilestones: Record<string, string[]>;
  workouts: Workout[];
  cravings: CravingEntry[];
  plans: IfThenPlan[];
  /** Wochenrückblick am Montag zeigen (abschaltbar) */
  weeklyReview: boolean;
  /** Montag der Woche, deren Rückblick schon gesehen wurde */
  reviewSeen: string;
  sportGoalMin: number;
  /** Effektstufe aus dem Profil; «auto» entscheidet das Gerät */
  fxLevel: FxChoice;
  adultConfirmed: boolean;
  /** Beispiel läuft nur im Arbeitsspeicher, nichts wird gespeichert. */
  demo: boolean;
  /** Letzter Speicherversuch ist fehlgeschlagen. */
  saveError: boolean;

  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  setActive: (id: string) => void;
  addEvent: (e: Omit<UseEvent, 'id' | 'updatedAt'>) => void;
  /** Letzten Eintrag von heute rückgängig machen */
  undoLastEvent: (goalId: string) => void;
  /** Menge eines Tages korrigieren (ersetzt alle Einträge dieses Tages) */
  setDayUnits: (goalId: string, day: string, units: number) => void;
  /** Menge und Preis ändern: ab heute oder rückwirkend (Tippfehler) */
  changeGoalRate: (id: string, next: { perDay: number; price: number }, retro: boolean) => void;
  /** «Stufe verlängern»: höchstens einmal pro Woche */
  extendStage: (id: string) => void;
  /** Check-in einmal pro Tag, änderbar */
  checkIn: (mood: 1 | 2 | 3) => void;
  /** Kurz-Tagebuch zum heutigen Check-in */
  setNote: (note: string) => void;
  addPlan: (when: string, then: string) => void;
  removePlan: (id: string) => void;
  setWeeklyReview: (v: boolean) => void;
  markReviewSeen: (week: string) => void;
  /** Abzeichen ohne Gewohnheit (Verlangen, Trainings) */
  markGlobal: (keys: string[]) => void;
  addSavings: (name: string, amount: number) => void;
  removeSavings: (id: string) => void;
  /** Sparziel in der Reihenfolge nach oben (-1) oder unten (1) schieben */
  moveSavings: (id: string, dir: -1 | 1) => void;
  markMilestones: (goalId: string, keys: string[]) => void;
  /** Gefeierte Meilensteine einer Gewohnheit ersetzen (zurückgesetzte fallen weg) */
  setMilestones: (goalId: string, keys: string[]) => void;
  confirmAdult: () => void;
  /** Ruhetag und Training am selben Tag schliessen sich aus. Gibt false zurück, wenn ein Ruhetag nicht geht. */
  addWorkout: (w: Omit<Workout, 'id'>) => boolean;
  removeWorkout: (id: string) => void;
  /** Gelöschtes Training zurückholen (Rückgängig) */
  restoreWorkout: (w: Workout) => void;
  setSportGoal: (m: number) => void;
  setFxLevel: (v: FxChoice) => void;
  addCraving: (level?: number) => void;
  /** Prüft eine Sicherung und liefert eine Vorschau, ohne etwas zu ändern. */
  previewImport: (json: string) => Promise<ImportPreview>;
  /** Ersetzt alle Daten durch eine geprüfte Sicherung. Gibt die Meldung für die Person zurück. */
  applyImport: (data: BackupData, dropped: number) => string;
  /** Löscht alle eigenen Daten. Im Beispiel beendet es nur das Beispiel. */
  wipe: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => Promise<void>;
}

const initial = () => ({
  goals: [] as Goal[],
  events: [] as UseEvent[],
  checkins: [] as CheckIn[],
  savings: [] as SavingsGoal[],
  activeGoalId: null as string | null,
  seenMilestones: {} as Record<string, string[]>,
  workouts: [] as Workout[],
  cravings: [] as CravingEntry[],
  plans: [] as IfThenPlan[],
  weeklyReview: true,
  reviewSeen: '',
  adultConfirmed: false,
  sportGoalMin: 150,
  fxLevel: 'auto' as FxChoice,
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      demo: false,
      saveError: false,
      addGoal: (g) => {
        const id = uid();
        const now = new Date().toISOString();
        set((s) => ({ goals: [...s.goals, { ...g, id, createdAt: now, updatedAt: now }], activeGoalId: id }));
        if (!get().demo) void requestPersistence();
        return id;
      },
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g)) })),
      // Löscht die Gewohnheit mit allem, was dazugehört: Einträge und Meilensteine. Check-ins gelten für den Tag und bleiben.
      removeGoal: (id) =>
        set((s) => {
          const goals = s.goals.filter((g) => g.id !== id);
          const seenMilestones = { ...s.seenMilestones };
          delete seenMilestones[id];
          return {
            goals,
            events: s.events.filter((e) => e.goalId !== id),
            seenMilestones,
            activeGoalId: s.activeGoalId === id ? (goals[0]?.id ?? null) : s.activeGoalId,
          };
        }),
      setActive: (id) => set({ activeGoalId: id }),
      addEvent: (e) => set((s) => ({ events: [...s.events, { ...e, id: uid(), updatedAt: new Date().toISOString() }] })),
      undoLastEvent: (goalId) =>
        set((s) => {
          const today = dayKey(new Date());
          let idx = -1;
          s.events.forEach((e, i) => {
            if (e.goalId === goalId && dayKey(new Date(e.at)) === today && (idx < 0 || e.at >= s.events[idx].at)) idx = i;
          });
          if (idx < 0) return {};
          return { events: s.events.filter((_, i) => i !== idx) };
        }),
      setDayUnits: (goalId, day, units) =>
        set((s) => {
          const goal = s.goals.find((g) => g.id === goalId);
          if (!goal) return {};
          const same = s.events.filter((e) => e.goalId === goalId && dayKey(new Date(e.at)) === day);
          const rest = s.events.filter((e) => !same.includes(e));
          const n = Math.max(0, Math.min(200, Math.round(units * 2) / 2));
          if (n === 0) return { events: rest };
          // Mittag des Tages, aber nie vor dem Start und nie in der Zukunft
          const noon = dayStart(day).getTime() + 12 * 3_600_000;
          const at = new Date(Math.min(Date.now(), Math.max(new Date(goal.startAt).getTime(), noon))).toISOString();
          const kind = goal.mode === 'quit' ? ('slip' as const) : ('log' as const);
          const trigger = same.find((e) => e.trigger)?.trigger;
          return { events: [...rest, { id: uid(), goalId, at, units: n, kind, trigger, updatedAt: new Date().toISOString() }] };
        }),
      changeGoalRate: (id, next, retro) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, rates: changeRate(g, next, dayKey(new Date()), retro), updatedAt: new Date().toISOString() } : g)),
        })),
      extendStage: (id) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, planExtensions: extendStage(g, dayKey(new Date())), updatedAt: new Date().toISOString() } : g)),
        })),
      checkIn: (mood) =>
        set((s) => {
          const day = dayKey(new Date());
          const prev = s.checkins.find((c) => c.day === day);
          const rest = s.checkins.filter((c) => c.day !== day);
          return { checkins: [...rest, { id: prev?.id ?? uid(), day, mood, note: prev?.note }] };
        }),
      setNote: (note) =>
        set((s) => {
          const day = dayKey(new Date());
          const text = note.trim().slice(0, 200) || undefined;
          return { checkins: s.checkins.map((c) => (c.day === day ? { ...c, note: text } : c)) };
        }),
      addPlan: (when, then) => set((s) => ({ plans: [...s.plans, { id: uid(), when: when.trim().slice(0, 60), then: then.trim().slice(0, 120) }] })),
      removePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      setWeeklyReview: (v) => set({ weeklyReview: v }),
      markReviewSeen: (week) => set({ reviewSeen: week }),
      markGlobal: (keys) => get().markMilestones(GLOBAL, keys),
      addSavings: (name, amount) => set((s) => ({ savings: [...s.savings, { id: uid(), name, amount }] })),
      removeSavings: (id) => set((s) => ({ savings: s.savings.filter((x) => x.id !== id) })),
      moveSavings: (id, dir) => set((s) => ({ savings: movePot(s.savings, id, dir) })),
      markMilestones: (goalId, keys) =>
        set((s) => ({ seenMilestones: { ...s.seenMilestones, [goalId]: [...new Set([...(s.seenMilestones[goalId] ?? []), ...keys])] } })),
      setMilestones: (goalId, keys) => set((s) => ({ seenMilestones: { ...s.seenMilestones, [goalId]: [...new Set(keys)] } })),
      confirmAdult: () => set({ adultConfirmed: true }),
      addWorkout: (w) => {
        const s = get();
        if (w.rest && s.workouts.some((x) => x.day === w.day && !x.rest)) return false;
        // Ruhetag und Training am selben Tag schliessen sich aus: ein Training ersetzt den Ruhetag
        const keep = s.workouts.filter((x) => !(x.day === w.day && x.rest));
        set({ workouts: [...keep, { ...w, id: uid() }] });
        return true;
      },
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      restoreWorkout: (w) => set((s) => (s.workouts.some((x) => x.id === w.id) ? {} : { workouts: [...s.workouts, w] })),
      setSportGoal: (m) => set({ sportGoalMin: clampSportGoal(m) }),
      setFxLevel: (v) => set({ fxLevel: isChoice(v) ? v : 'auto' }),
      addCraving: (level) =>
        set((s) => ({
          cravings: [...s.cravings, { id: uid(), at: new Date().toISOString(), level: level === undefined ? undefined : Math.max(1, Math.min(5, Math.round(level))) }],
        })),
      previewImport: async (json) => {
        // zod nur laden, wenn wirklich importiert wird
        const { importSummary, validateImport } = await import('../domain/backup');
        const r = validateImport(json);
        if (!r.ok) return { ok: false, message: r.error };
        return { ok: true, data: r.data, dropped: r.dropped, ...importSummary(r.data) };
      },
      applyImport: (data, dropped) => {
        // Ein Import beendet ein laufendes Beispiel und wird gespeichert
        setStorageDemo(false);
        const { settings, ...rest } = data;
        set({
          ...rest,
          sportGoalMin: settings.sportGoalMin,
          fxLevel: isChoice(settings.fxLevel) ? settings.fxLevel : 'auto',
          weeklyReview: settings.weeklyReview,
          activeGoalId: data.goals[0].id,
          adultConfirmed: true,
          demo: false,
        });
        return app.profil.imported(dropped);
      },
      wipe: async () => {
        if (get().demo) return get().exitDemo();
        set(initial());
        await useStore.persist.clearStorage();
      },
      // Beispiel nur im Arbeitsspeicher: erst Schreiben sperren, dann Daten ersetzen
      enterDemo: () => {
        setStorageDemo(true);
        set({ ...initial(), ...exampleData(), fxLevel: get().fxLevel, adultConfirmed: true, demo: true });
      },
      // Zurück zu den eigenen Daten. Nie zwischendurch leer werden, sonst springt die App ins Onboarding.
      exitDemo: async () => {
        const stored = await appStorage.getItem(STORAGE_KEY);
        setStorageDemo(false);
        if (stored) {
          // Ersetzt alle gespeicherten Felder, das Beispiel verschwindet vollständig
          await useStore.persist.rehydrate();
          set({ demo: false });
        } else {
          set({ ...initial(), demo: false });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => appStorage),
      version: PERSIST_VERSION,
      // Nur Nutzerdaten speichern, nie Funktionen oder Zwischenzustände
      partialize: (s) => Object.fromEntries(PERSISTED_KEYS.map((k) => [k, s[k]])) as Partial<State>,
      migrate: (persisted, version) => migratePersisted(persisted, version) as unknown as State,
    },
  ),
);

onSaveError((failed) => {
  if (useStore.getState().saveError !== failed) useStore.setState({ saveError: failed });
});

/** true, sobald die gespeicherten Daten geladen sind (IndexedDB ist asynchron). */
export function useHydrated(): boolean {
  const [done, setDone] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const un = useStore.persist.onFinishHydration(() => setDone(true));
    setDone(useStore.persist.hasHydrated());
    return un;
  }, []);
  return done;
}

export function exportJson(): string {
  const s = useStore.getState();
  return serializeBackup({
    goals: s.goals,
    events: s.events,
    checkins: s.checkins,
    savings: s.savings,
    workouts: s.workouts,
    cravings: s.cravings,
    plans: s.plans,
    seenMilestones: s.seenMilestones,
    settings: { sportGoalMin: s.sportGoalMin, fxLevel: s.fxLevel, weeklyReview: s.weeklyReview },
  });
}
