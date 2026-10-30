import { describe, expect, it } from 'vitest';
import { goalSummary, yearly } from './stats';
import { planSteps, limitForDay } from './reduction';
import { addDays, daysBetween } from './time';
import { chf } from './format';
import type { Goal, UseEvent } from './types';

const base = (over: Partial<Goal> & { perDay?: number; price?: number } = {}): Goal => {
  const { perDay = 10, price = 0.45, ...rest } = over;
  const startAt = rest.startAt ?? new Date(2026, 9, 20, 8, 0).toISOString();
  const d = new Date(startAt);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    id: 'g1',
    templateKey: 'zig',
    name: 'Zigaretten',
    emoji: '🚬',
    unit: 'Zigaretten',
    rates: [{ validFrom: day, perDay, price }],
    mode: 'quit',
    startAt,
    createdAt: '',
    updatedAt: '',
    ...rest,
  };
};

const slip = (at: Date, units = 1): UseEvent => ({ id: Math.random().toString(), goalId: 'g1', at: at.toISOString(), units, kind: 'slip', updatedAt: '' });

describe('Zeit', () => {
  it('zählt Kalendertage über die Winterzeit-Umstellung', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('Statistik Aufhören', () => {
  it('am Starttag: heute ist schon ein guter Tag, Geld läuft nach echter Zeit', () => {
    const g = base({ startAt: new Date(2026, 9, 23, 8, 0).toISOString() });
    const s = goalSummary(g, [], new Date(2026, 9, 23, 20, 0));
    expect(s.goodDays).toBe(1);
    expect(s.streak).toBe(1);
    expect(s.saved).toBeCloseTo(10 * 0.45 * 0.5, 2);
    expect(s.cleanFrom).toBe(new Date(2026, 9, 23, 8, 0).getTime());
  });

  it('gute Tage bleiben nach einem Ausrutscher erhalten', () => {
    const g = base();
    const events = [slip(new Date(2026, 9, 22, 14, 0)), slip(new Date(2026, 9, 22, 18, 0))];
    const s = goalSummary(g, events, new Date(2026, 9, 25, 9, 0));
    // Tage 20 bis 25 (heute inklusive); 22 ist kein guter Tag
    expect(s.totalDays).toBe(6);
    expect(s.goodDays).toBe(5);
    expect(s.streak).toBe(3);
    expect(s.bestStreak).toBe(3);
    expect(s.cleanFrom).toBe(new Date(2026, 9, 22, 18).getTime());
  });

  it('Ersparnis sinkt nur um den tatsächlichen Konsum', () => {
    const g = base();
    const now = new Date(2026, 9, 21, 8, 0); // genau 1 Tag
    const without = goalSummary(g, [], now);
    const withSlip = goalSummary(g, [slip(new Date(2026, 9, 20, 12), 3)], now);
    expect(without.saved).toBeCloseTo(4.5, 2);
    expect(withSlip.saved).toBeCloseTo(4.5 - 3 * 0.45, 2);
  });

  it('Start in der Zukunft gibt 0', () => {
    const g = base({ startAt: new Date(2026, 9, 30).toISOString() });
    const s = goalSummary(g, [], new Date(2026, 9, 25));
    expect(s.saved).toBe(0);
    expect(s.goodDays).toBe(0);
  });

  it('Jahresprojektion', () => {
    expect(yearly(20, 0.45).chf).toBeCloseTo(3285, 5);
  });
});

describe('Reduktion', () => {
  it('lineare Wochenstufen bis 0', () => {
    expect(planSteps(20, 0, 4)).toEqual([15, 10, 5, 0]);
  });
  it('ohne doppelte Stufen: der Plan wird kürzer', () => {
    expect(planSteps(0.5, 0, 4, 0.5)).toEqual([0]);
    expect(planSteps(3, 0, 4)).toEqual([2, 1, 0]);
  });
  it('Tag im Plan ist ein guter Tag, heute zählt mit', () => {
    const g = base({ mode: 'reduce', perDay: 20, targetPerDay: 0, planWeeks: 4 });
    expect(limitForDay(g, '2026-10-20')).toBe(15);
    expect(limitForDay(g, '2026-10-27')).toBe(10);
    const log = (d: Date, u: number): UseEvent => ({ id: Math.random().toString(), goalId: 'g1', at: d.toISOString(), units: u, kind: 'log', updatedAt: '' });
    const s = goalSummary(g, [log(new Date(2026, 9, 20, 12), 14), log(new Date(2026, 9, 21, 12), 16)], new Date(2026, 9, 22, 12));
    expect(s.goodDays).toBe(2);
    expect(s.totalDays).toBe(3);
    expect(s.streak).toBe(1);
  });
  it('Stufe verlängern hält die Stufe länger', () => {
    const g = base({ mode: 'reduce', perDay: 20, targetPerDay: 0, planWeeks: 4, planExtensions: ['2026-10-20'] });
    expect(limitForDay(g, '2026-10-27')).toBe(15);
    expect(limitForDay(g, '2026-11-03')).toBe(10);
  });
});

describe('Serie bei Ausrutscher heute', () => {
  it('Serie fällt auf 0, gute Tage bleiben', () => {
    const g = base();
    const s = goalSummary(g, [slip(new Date(2026, 9, 25, 7, 0))], new Date(2026, 9, 25, 9, 0));
    expect(s.streak).toBe(0);
    expect(s.goodDays).toBe(5);
  });
  it('Ereignis vor dem Start zählt nicht', () => {
    const g = base({ startAt: new Date(2026, 9, 20, 12, 0).toISOString() });
    const s = goalSummary(g, [slip(new Date(2026, 9, 20, 9, 0))], new Date(2026, 9, 22, 9, 0));
    expect(s.goodDays).toBe(3);
  });
});

describe('Format', () => {
  it('CHF mit Apostroph', () => {
    expect(chf(3285)).toBe('3’285.00');
  });
});
