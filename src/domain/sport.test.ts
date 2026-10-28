import { words } from '../i18n/de-CH';
import { describe, expect, it } from 'vitest';
import { weekStart, weekSums, weekStreak, sportStats, isMonday, effortOf, EFFORT_RPE, type Workout } from './sport';

const w = (day: string, minutes: number, sport = 'laufen', distanceKm?: number): Workout => ({ id: day + minutes + sport, day, at: day + 'T10:00:00Z', sport, minutes, distanceKm });

describe('Sport', () => {
  it('Woche beginnt am Montag', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-19'); // Samstag
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Montag
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sonntag
  });
  it('Wochensummen', () => {
    const s = weekSums([w('2026-10-19', 30), w('2026-10-19', 20), w('2026-10-21', 45), w('2026-10-12', 60)], '2026-10-24', 2, 90);
    expect(s[1]).toMatchObject({ minutes: 95, sessions: 3, activeDays: 2, reached: true });
    expect(s[0]).toMatchObject({ minutes: 60, reached: false });
  });
  it('Serie in Wochen, laufende Woche bricht sie nicht', () => {
    const data = [w('2026-10-05', 150), w('2026-10-12', 150), w('2026-10-20', 20)];
    expect(weekStreak(data, '2026-10-24', 150)).toBe(2);
    expect(weekStreak([...data, w('2026-10-22', 140)], '2026-10-24', 150)).toBe(3);
  });
  it('Statistik und Rekorde', () => {
    const data = [w('2026-10-20', 40, 'velo', 15), w('2026-10-22', 75, 'laufen', 10.5), w('2026-10-23', 30, 'velo', 8)];
    const s = sportStats(data, new Date(2026, 9, 24, 12), 150, '2026-10-21');
    expect(s.weekMinutes).toBe(145);
    expect(s.totalKm).toBeCloseTo(33.5);
    expect(s.longest?.minutes).toBe(75);
    expect(s.favorite).toBe('velo');
    expect(s.sinceQuit).toBe(2);
    expect(s.daysSinceLast).toBe(1);
  });
  it('Ruhetage zählen nicht als Minuten, aber positiv', () => {
    const rest: Workout = { id: 'r', day: '2026-10-23', at: '', sport: 'andere', minutes: 0, rest: true };
    const s = sportStats([w('2026-10-20', 30), rest], new Date(2026, 9, 24, 12), 150);
    expect(s.weekMinutes).toBe(30);
    expect(s.weekRestDays).toBe(1);
    expect(s.totalSessions).toBe(1);
  });
  it('letzte 7 Tage rollend, Montag erkennt die neue Woche', () => {
    const today = '2026-10-26'; // Montag
    const s = sportStats([w('2026-10-20', 30), w('2026-10-19', 40), w('2026-10-25', 50)], new Date(2026, 9, 26, 9), 150);
    expect(isMonday(today)).toBe(true);
    expect(s.weekMinutes).toBe(0); // neue Kalenderwoche
    expect(s.last7.minutes).toBe(80); // 20. und 25., der 19. ist zu alt
    expect(s.lastWeekMinutes).toBe(120);
    expect(effortOf(EFFORT_RPE[3])).toBe(3);
    expect(effortOf(6)).toBe(2);
  });
  it('Minuten als Text, ohne Abkürzungen', () => {
    expect(words.minutesLong(45)).toBe('45 Minuten');
    expect(words.minutesLong(150)).toBe('2 Stunden 30 Minuten');
  });
});
