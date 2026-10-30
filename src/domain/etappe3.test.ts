import { describe, expect, it } from 'vitest';
import { badgeList, detectBadges } from './milestones';
import { challengeHash, dayPart, lastWeekReview, parseChallenge, patterns, shareContent, suggestTriggers } from './insights';
import type { Goal, UseEvent } from './types';
import type { Workout } from './sport';

describe('Abzeichen: Verlangen überstanden', () => {
  it('einmal feiern, dann merken', () => {
    const r = detectBadges(1, []);
    expect(r.newKeys).toEqual(['c1']);
    expect(r.celebrate).toEqual({ kind: 'craving', n: 1 });
    expect(detectBadges(3, r.newKeys).celebrate).toBeNull();
  });
  it('Liste zum Anzeigen: Tage, Geld, Verlangen', () => {
    const list = badgeList({ bestDays: 8, saved: 60, cravings: 0, hasMoney: true });
    expect(list.filter((b) => b.reached).map((b) => b.key)).toEqual(['d1', 'd7', 'm10', 'm50']);
    expect(badgeList({ bestDays: 0, saved: 0, cravings: 0, hasMoney: false }).some((b) => b.kind === 'money')).toBe(false);
  });
});

const slip = (at: Date, trigger?: string): UseEvent => ({ id: at.toISOString(), goalId: 'g1', at: at.toISOString(), units: 1, kind: 'slip', trigger, updatedAt: '' });

describe('Muster aus Auslösern', () => {
  it('zählt Auslöser, Tageszeit und Wochentag', () => {
    const p = patterns(
      [slip(new Date(2026, 9, 19, 20), 'Stress'), slip(new Date(2026, 9, 21, 21), 'Stress'), slip(new Date(2026, 9, 22, 8), 'Langeweile')],
      [{ id: 'c', at: new Date(2026, 9, 19, 22).toISOString(), level: 3 }],
    );
    expect(p.total).toBe(4);
    expect(p.triggers[0]).toEqual({ name: 'Stress', count: 2 });
    expect(p.parts[0]).toEqual({ part: 'abend', count: 3 });
    expect(p.topWeekday).toBe(0); // Montag, 19.10.2026
    expect(dayPart(new Date(2026, 0, 1, 2))).toBe('nacht');
    expect(suggestTriggers(p, ['Stress', 'Langeweile', 'Müdigkeit'])).toEqual(['Stress', 'Langeweile', 'Müdigkeit']);
  });
});

describe('Wochenrückblick', () => {
  it('rechnet die letzte Kalenderwoche: gute Tage, gespart, Trainingsminuten', () => {
    const g: Goal = {
      id: 'g1', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', rates: [{ validFrom: '2026-10-01', perDay: 1, price: 2 }], mode: 'quit',
      startAt: new Date(2026, 9, 1, 8).toISOString(), createdAt: '', updatedAt: '',
    };
    const ws: Workout[] = [
      { id: 'a', day: '2026-10-20', at: '', sport: 'laufen', minutes: 40 },
      { id: 'b', day: '2026-10-26', at: '', sport: 'laufen', minutes: 30 },
    ];
    const r = lastWeekReview([g], [slip(new Date(2026, 9, 21, 12))], ws, new Date(2026, 9, 26, 9));
    expect(r?.week).toBe('2026-10-19');
    expect(r?.perGoal).toEqual([{ goalId: 'g1', name: 'Mate', mode: 'quit', good: 6, of: 7 }]);
    // Jeder Kalendertag zählt ganz, auch der 25-Stunden-Tag der Winterzeit
    expect(r?.saved).toBe(7 * 2 - 2);
    expect(r?.trainingMinutes).toBe(40);
    expect(lastWeekReview([], [], [], new Date())).toBeNull();
  });
});

describe('Teilen-Karte', () => {
  it('standardmässig ohne Gewohnheit und Betrag', () => {
    expect(shareContent({ goodDays: 25, habit: 'Mate', amount: 80.4, showHabit: false, showAmount: false, showDays: true })).toEqual({ days: 25, habit: null, amount: null });
    expect(shareContent({ goodDays: 25, habit: 'Mate', amount: 80.4, showHabit: true, showAmount: true, showDays: false })).toEqual({ days: null, habit: 'Mate', amount: 80.4 });
  });
});

describe('Challenge-Link', () => {
  it('liest nur gültige Links', () => {
    expect(challengeHash('mate', 14)).toBe('#c=mate-14');
    expect(parseChallenge('#c=mate-14', ['mate'])).toEqual({ templateKey: 'mate', days: 14 });
    expect(parseChallenge('#c=gift-14', ['mate'])).toBeNull();
    expect(parseChallenge('#c=mate-999', ['mate'])).toBeNull();
    expect(parseChallenge('#c=mate-14<script>', ['mate'])).toBeNull();
  });
});
