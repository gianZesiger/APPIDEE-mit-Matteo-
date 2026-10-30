import { describe, expect, it } from 'vitest';
import { goalSummary } from './stats';
import { sportStats, weekStart, weekStreak, type Workout } from './sport';
import type { Goal, UseEvent } from './types';

// Läuft mit TZ=Europe/Zurich (vite.config.ts). Winterzeit beginnt am 25.10.2026 um 03:00.

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', rates: [{ validFrom: '2026-10-24', perDay: 1, price: 1.9 }], mode: 'quit',
  startAt: new Date(2026, 9, 24, 8, 0).toISOString(), createdAt: '', updatedAt: '', ...over,
});
const slip = (at: Date, units = 1): UseEvent => ({ id: at.toISOString(), goalId: 'g1', at: at.toISOString(), units, kind: 'slip', updatedAt: '' });
const w = (day: string, minutes: number, extra: Partial<Workout> = {}): Workout => ({ id: day + minutes, day, at: `${day}T10:00:00Z`, sport: 'laufen', minutes, ...extra });

describe('Zeitzone', () => {
  it('Tests laufen in Europe/Zurich', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-120);
  });
});

describe('Sommer-/Winterzeit 25.10.2026', () => {
  it('Kalendertage stimmen, die Ersparnis läuft nach echter Zeit', () => {
    const s = goalSummary(goal(), [], new Date(2026, 9, 26, 8, 0));
    // 24.10. ab 08:00 (16 von 24 Stunden), 25.10. ganz (25 Stunden, zählt als 1 Tag), 26.10. bis 08:00 (8 von 24)
    expect(s.totalDays).toBe(3);
    expect(s.goodDays).toBe(3);
    expect(s.saved).toBeCloseTo((16 / 24 + 1 + 8 / 24) * 1.9, 2);
  });

  it('Ausrutscher in der doppelten Stunde zählt zum 25.10.', () => {
    const at = new Date('2026-10-25T00:30:00Z'); // 02:30 Winterzeit, nach der Umstellung
    const s = goalSummary(goal(), [slip(at)], new Date(2026, 9, 27, 9, 0));
    expect(s.days.find((d) => d.day === '2026-10-25')?.win).toBe(false);
    expect(s.goodDays).toBe(3);
    expect(s.streak).toBe(2);
  });

  it('Sport-Woche bleibt Montag bis Sonntag', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    const st = sportStats([w('2026-10-25', 60), w('2026-10-26', 30)], new Date(2026, 9, 26, 20), 150);
    expect(st.weekMinutes).toBe(30);
  });
});

describe('Sport', () => {
  it('Wochenserie: laufende Woche bricht sie nie, eine verpasste Woche schon', () => {
    const data = [w('2026-09-28', 150), w('2026-10-05', 150), w('2026-10-12', 150)];
    expect(weekStreak(data, '2026-10-24', 150)).toBe(3); // Woche vom 19.10. läuft noch
    expect(weekStreak(data, '2026-10-27', 150)).toBe(0); // Woche vom 19.10. verpasst
    expect(weekStreak([...data, w('2026-10-19', 150)], '2026-10-27', 150)).toBe(4); // neue Woche läuft
  });
  it('Ruhetage zählen als Ruhe, nicht als Training, und brechen nichts', () => {
    const rest = w('2026-10-23', 0, { rest: true, sport: 'andere' });
    const st = sportStats([w('2026-10-20', 160), rest], new Date(2026, 9, 24, 12), 150);
    expect(st.weekRestDays).toBe(1);
    expect(st.totalSessions).toBe(1);
    expect(st.weekProgress).toBeGreaterThan(1);
  });
  it('Rekorde: längste Einheit, beste Woche, Distanz, Lieblingssport', () => {
    const st = sportStats(
      [w('2026-10-06', 90, { sport: 'velo', distanceKm: 30 }), w('2026-10-07', 60, { sport: 'velo', distanceKm: 20 }), w('2026-10-21', 120, { sport: 'wandern', distanceKm: 9 })],
      new Date(2026, 9, 24, 12),
      150,
    );
    expect(st.longest?.minutes).toBe(120);
    expect(st.bestWeek).toBe(150);
    expect(st.totalKm).toBe(59);
    expect(st.favorite).toBe('velo');
  });
});
