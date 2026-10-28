import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CheckIn, CravingEntry, Goal, IfThenPlan, SavingsGoal, UseEvent } from '../domain/types';
import type { Workout } from '../domain/sport';
import { exampleData } from './example';
import { dayKey } from '../domain/time';
import { clampSportGoal, serializeBackup } from '../domain/limits';
import { migratePersisted, PERSIST_VERSION, PERSISTED_KEYS } from '../domain/persist';
import { movePot } from '../domain/savings';
import { GLOBAL } from '../domain/milestones';
import { app } from '../i18n/de-CH';
import { appStorage, onSaveError, requestPersistence, setStorageDemo } from './storage';
import { isChoice, type FxChoice } from '../ui/fx-level';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const STORAGE_KEY = 'weniger-solo';

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
  undoLastEvent: (goalId: string) => void;
  checkIn: (goalId: string, mood: 1 | 2 | 3) => void;
  /** Kurz-Tagebuch zum heutigen Check-in */
  setNote: (goalId: string, note: string) => void;
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
  confirmAdult: () => void;
  addWorkout: (w: Omit<Workout, 'id'>) => void;
  removeWorkout: (id: string) => void;
  /** Gelöschtes Training zurückholen (Rückgängig) */
  restoreWorkout: (w: Workout) => void;
  setSportGoal: (m: number) => void;
  setFxLevel: (v: FxChoice) => void;
  addCraving: (level: number) => void;
  /** Lädt eine Sicherung. Gibt eine Meldung für die Person zurück. */
  importData: (json: string) => Promise<{ ok: boolean; message: string }>;
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
      // Löscht die Gewohnheit mit allem, was dazugehört: Einträge, Check-ins und Meilensteine.
      removeGoal: (id) =>
        set((s) => {
          const goals = s.goals.filter((g) => g.id !== id);
          const seenMilestones = { ...s.seenMilestones };
          delete seenMilestones[id];
          return {
            goals,
            events: s.events.filter((e) => e.goalId !== id),
            checkins: s.checkins.filter((c) => c.goalId !== id),
            seenMilestones,
            activeGoalId: s.activeGoalId === id ? (goals[0]?.id ?? null) : s.activeGoalId,
          };
        }),
      setActive: (id) => set({ activeGoalId: id }),
      addEvent: (e) => set((s) => ({ events: [...s.events, { ...e, id: uid(), updatedAt: new Date().toISOString() }] })),
      undoLastEvent: (goalId) =>
        set((s) => {
          const idx = s.events.map((e) => e.goalId).lastIndexOf(goalId);
          if (idx < 0) return {};
          const events = [...s.events];
          events.splice(idx, 1);
          return { events };
        }),
      checkIn: (goalId, mood) =>
        set((s) => {
          const day = dayKey(new Date());
          const prev = s.checkins.find((c) => c.goalId === goalId && c.day === day);
          const rest = s.checkins.filter((c) => c !== prev);
          return { checkins: [...rest, { id: uid(), goalId, day, mood, note: prev?.note }] };
        }),
      setNote: (goalId, note) =>
        set((s) => {
          const day = dayKey(new Date());
          const text = note.trim().slice(0, 200) || undefined;
          return { checkins: s.checkins.map((c) => (c.goalId === goalId && c.day === day ? { ...c, note: text } : c)) };
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
      confirmAdult: () => set({ adultConfirmed: true }),
      addWorkout: (w) => set((s) => ({ workouts: [...s.workouts, { ...w, id: uid() }] })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      restoreWorkout: (w) => set((s) => (s.workouts.some((x) => x.id === w.id) ? {} : { workouts: [...s.workouts, w] })),
      setSportGoal: (m) => set({ sportGoalMin: clampSportGoal(m) }),
      setFxLevel: (v) => set({ fxLevel: isChoice(v) ? v : 'auto' }),
      addCraving: (level) => set((s) => ({ cravings: [...s.cravings, { id: uid(), at: new Date().toISOString(), level: Math.max(1, Math.min(5, Math.round(level))) }] })),
      importData: async (json) => {
        // zod nur laden, wenn wirklich importiert wird
        const { validateImport } = await import('../domain/backup');
        const r = validateImport(json);
        if (!r.ok) return { ok: false, message: r.error };
        // Ein Import beendet ein laufendes Beispiel und wird gespeichert
        setStorageDemo(false);
        set({ ...r.data, activeGoalId: r.data.goals[0].id, seenMilestones: {}, adultConfirmed: true, demo: false });
        return { ok: true, message: app.profil.imported(r.dropped) };
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
  return serializeBackup({ goals: s.goals, events: s.events, checkins: s.checkins, savings: s.savings, workouts: s.workouts, cravings: s.cravings, plans: s.plans, sportGoalMin: s.sportGoalMin });
}
