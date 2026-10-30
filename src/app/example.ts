import type { Goal, UseEvent } from '../domain/types';
import type { Workout } from '../domain/sport';
import { addDays, dayKey } from '../domain/time';
import { GLOBAL, reconcileMilestones } from '../domain/milestones';
import { goalSummary } from '../domain/stats';
import { hasMoney } from '../domain/rates';

/** Beispieldaten zum Ausprobieren. Klar als Beispiel markiert, nicht die Daten der Person. */
export function exampleData(now = new Date()) {
  const ago = (d: number, h = 8) => {
    const x = new Date(now);
    x.setDate(x.getDate() - d);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const iso = new Date().toISOString();
  const goals: Goal[] = [
    { id: 'ex-mate', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', unitOne: 'Mate', rates: [{ validFrom: dayKey(new Date(ago(43))), perDay: 1, price: 1.9 }], mode: 'quit', startAt: ago(43), createdAt: iso, updatedAt: iso, why: 'Besser schlafen vor Prüfungen' },
    { id: 'ex-kaffee', templateKey: 'kaffee', name: 'Kaffee', emoji: '☕', unit: 'Tassen', unitOne: 'Tasse', rates: [{ validFrom: dayKey(new Date(ago(12))), perDay: 4, price: 1.2 }], mode: 'reduce', targetPerDay: 0, planWeeks: 4, startAt: ago(12), createdAt: iso, updatedAt: iso },
  ];
  const events: UseEvent[] = [{ id: 'ex-s1', goalId: 'ex-mate', at: ago(25, 15), units: 1, kind: 'slip', trigger: 'Stress', updatedAt: iso }];
  for (let d = 11; d >= 1; d--) {
    events.push({ id: `ex-k${d}`, goalId: 'ex-kaffee', at: ago(d, 9), units: d > 7 ? 3 : 2, kind: 'log', updatedAt: iso });
  }
  const today = dayKey(now);
  const plan: [number, string, number, number?][] = [
    [40, 'laufen', 35, 6], [38, 'kraft', 45], [36, 'velo', 60, 22], [33, 'laufen', 40, 7], [31, 'fussball', 90], [29, 'yoga', 30],
    [26, 'laufen', 45, 8], [24, 'velo', 75, 28], [22, 'kraft', 50], [19, 'wandern', 180, 12], [17, 'laufen', 30, 5],
    [15, 'fussball', 90], [12, 'schwimmen', 40, 1.5], [10, 'laufen', 50, 9], [8, 'velo', 45, 16], [5, 'kraft', 45], [3, 'laufen', 35, 6], [1, 'fussball', 90],
  ];
  const workouts: Workout[] = plan.map(([d, sport, minutes, km], i) => ({ id: `ex-w${i}`, day: addDays(today, -d), at: ago(d, 18), sport, minutes, distanceKm: km, rpe: 5 + (i % 3) }));
  workouts.push({ id: 'ex-r1', day: addDays(today, -2), at: ago(2, 20), sport: 'andere', minutes: 0, rest: true });
  // Erreichte Meilensteine gelten als schon gefeiert, damit das Beispiel nicht sofort feiert
  const seen: Record<string, string[]> = { [GLOBAL]: ['c1'] };
  for (const g of goals) {
    const s = goalSummary(g, events, now);
    seen[g.id] = reconcileMilestones(s.streak, s.saved, [], hasMoney(g)).keep;
  }
  const plans = [{ id: 'ex-p1', when: 'Wenn ich Stress habe', then: 'atme ich eine Minute und trinke ein Glas Wasser' }];
  const cravings = [{ id: 'ex-c1', at: ago(6, 21), level: 2 }];
  return { goals, events, workouts, plans, cravings, savings: [{ id: 'ex-sg', name: 'Laufschuhe', amount: 150 }], seenMilestones: seen, activeGoalId: 'ex-mate' };
}
