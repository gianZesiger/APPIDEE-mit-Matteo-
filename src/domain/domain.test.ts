import { describe, expect, it } from 'vitest';
import { computeStats, yearly } from './stats';
import { planSteps, limitForDay } from './reduction';
import { addDays, daysBetween } from './time';
import { chf } from './format';
import type { Goal, UseEvent } from './types';

const base = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  templateKey: 'zig',
  name: 'Zigaretten',
  emoji: '🚬',
  unit: 'Zigaretten',
  perDay: 10,
  price: 0.45,
  mode: 'quit',
  startAt: new Date(2026, 9, 20, 8, 0).toISOString(),
  createdAt: '',
  updatedAt: '',
  ...over,
});

const slip = (at: Date, units = 1): UseEvent => ({ id: Math.random().toString(), goalId: 'g1', at: at.toISOString(), units, kind: 'slip', updatedAt: '' });

describe('Zeit', () => {
  it('zählt Kalendertage über die Winterzeit-Umstellung', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('Statistik Aufhören', () => {
  it('zeigt am Starttag keine reinen Nullen beim Geld', () => {
    const g = base({ startAt: new Date(2026, 9, 23, 8, 0).toISOString() });
    const s = computeStats(g, [], new Date(2026, 9, 23, 20, 0));
    expect(s.winDays).toBe(0);
    expect(s.saved).toBeCloseTo(10 * 0.45 * 0.5, 5);
    expect(s.cleanMs).toBe(12 * 3_600_000);
  });

  it('Gewinn-Tage bleiben nach einem Ausrutscher erhalten', () => {
    const g = base();
    const events = [slip(new Date(2026, 9, 22, 14, 0)), slip(new Date(2026, 9, 22, 18, 0))];
    const s = computeStats(g, events, new Date(2026, 9, 25, 9, 0));
    // Tage 20,21,22,23,24 abgeschlossen; 22 ist kein Gewinn-Tag
    expect(s.totalDays).toBe(5);
    expect(s.winDays).toBe(4);
    expect(s.streak).toBe(2);
    expect(s.bestStreak).toBe(2);
    expect(s.cleanMs).toBe(new Date(2026, 9, 25, 9).getTime() - new Date(2026, 9, 22, 18).getTime());
  });

  it('Ersparnis sinkt nur um den tatsächlichen Konsum', () => {
    const g = base();
    const now = new Date(2026, 9, 21, 8, 0); // genau 1 Tag
    const without = computeStats(g, [], now);
    const withSlip = computeStats(g, [slip(new Date(2026, 9, 20, 12), 3)], now);
    expect(without.saved).toBeCloseTo(4.5, 5);
    expect(withSlip.saved).toBeCloseTo(4.5 - 3 * 0.45, 5);
  });

  it('Start in der Zukunft gibt 0', () => {
    const g = base({ startAt: new Date(2026, 9, 30).toISOString() });
    const s = computeStats(g, [], new Date(2026, 9, 25));
    expect(s.saved).toBe(0);
    expect(s.winDays).toBe(0);
  });

  it('Jahresprojektion', () => {
    expect(yearly(20, 0.45).chf).toBeCloseTo(3285, 5);
  });
});

describe('Reduktion', () => {
  it('lineare Wochenstufen bis 0', () => {
    expect(planSteps(20, 0, 4)).toEqual([15, 10, 5, 0]);
  });
  it('Bruchzahlen bleiben in Stufen erhalten', () => {
    expect(planSteps(0.5, 0, 4, 0.5)).toEqual([0.5, 0.5, 0.5, 0]);
    expect(planSteps(3, 0, 4)).toEqual([2, 2, 1, 0]);
  });
  it('Tag unter dem Limit ist ein Gewinn-Tag', () => {
    const g = base({ mode: 'reduce', perDay: 20, targetPerDay: 0, planWeeks: 4 });
    expect(limitForDay(g, '2026-10-20')).toBe(15);
    expect(limitForDay(g, '2026-10-27')).toBe(10);
    const log = (d: Date, u: number): UseEvent => ({ id: Math.random().toString(), goalId: 'g1', at: d.toISOString(), units: u, kind: 'log', updatedAt: '' });
    const s = computeStats(g, [log(new Date(2026, 9, 20, 12), 14), log(new Date(2026, 9, 21, 12), 16)], new Date(2026, 9, 22, 12));
    expect(s.winDays).toBe(1);
    expect(s.totalDays).toBe(2);
  });
  it('Stufe verlängern verschiebt den Plan', () => {
    const g = base({ mode: 'reduce', perDay: 20, targetPerDay: 0, planWeeks: 4, planExtraWeeks: 1 });
    expect(limitForDay(g, '2026-10-27')).toBe(15);
  });
});

describe('Serie bei Ausrutscher heute', () => {
  it('Serie fällt auf 0, Gewinn-Tage bleiben', () => {
    const g = base();
    const s = computeStats(g, [slip(new Date(2026, 9, 25, 7, 0))], new Date(2026, 9, 25, 9, 0));
    expect(s.streak).toBe(0);
    expect(s.winDays).toBe(5);
  });
  it('Ereignis vor dem Start zählt nicht', () => {
    const g = base({ startAt: new Date(2026, 9, 20, 12, 0).toISOString() });
    const s = computeStats(g, [slip(new Date(2026, 9, 20, 9, 0))], new Date(2026, 9, 22, 9, 0));
    expect(s.winDays).toBe(2);
  });
});

describe('Format', () => {
  it('CHF mit Apostroph', () => {
    expect(chf(3285)).toBe('3’285.00');
  });
});
