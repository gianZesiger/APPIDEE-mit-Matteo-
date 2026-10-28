import { describe, expect, it } from 'vitest';
import { badgeList, detectBadges, detectMilestones, migrateSeenKeys, nextDayMilestone } from './milestones';
import { challengeHash, dayPart, lastWeekReview, parseChallenge, patterns, shareContent, suggestTriggers } from './insights';
import type { Goal, UseEvent } from './types';
import type { Workout } from './sport';

const D = 86_400_000;

describe('Meilensteine 1, 7, 30, 100, 365 Tage und CHF 10, 50, 100, 500', () => {
  it('feiert den höchsten neuen Tag, markiert alles, nur einmal', () => {
    const r = detectMilestones(40 * D, 120, [], 'start', true);
    expect(r.celebrate).toEqual({ kind: 'days', n: 30 });
    expect(r.newKeys).toEqual(['d1@start', 'd7@start', 'd30@start', 'm10', 'm50', 'm100']);
    const again = detectMilestones(40 * D, 120, r.newKeys, 'start', true);
    expect(again.newKeys).toHaveLength(0);
    expect(again.celebrate).toBeNull();
  });
  it('Geld wird gefeiert, wenn kein neuer Tag dazukommt; ohne Preis nie', () => {
    expect(detectMilestones(2 * D, 12, ['d1@s'], 's', true).celebrate).toEqual({ kind: 'money', n: 10 });
    expect(detectMilestones(2 * D, 12, ['d1@s'], 's', false).newKeys).toEqual([]);
  });
  it('nach einem Ausrutscher beginnt eine neue Serie, Geld bleibt gefeiert', () => {
    const first = detectMilestones(8 * D, 60, [], 'start', true);
    const after = detectMilestones(1.5 * D, 61, first.newKeys, 'slip-1', true);
    expect(after.newKeys).toEqual(['d1@slip-1']);
    expect(after.celebrate).toEqual({ kind: 'days', n: 1 });
  });
  it('Fortschritt zum nächsten Meilenstein', () => {
    expect(nextDayMilestone(0.5 * D)).toEqual({ prev: 0, next: 1, progress: 0.5 });
    expect(nextDayMilestone(4 * D).next).toBe(7);
    expect(nextDayMilestone(400 * D)).toEqual({ prev: 365, next: null, progress: 1 });
  });
  it('alte Schlüssel werden umgerechnet, damit nichts doppelt gefeiert wird', () => {
    const old = ['t3600000@s1', `t${30 * D}@s1`, 'm100', 'm1000'];
    expect(migrateSeenKeys(old).sort()).toEqual(['d1@s1', 'd30@s1', 'd7@s1', 'm100']);
  });
});

describe('Abzeichen: Verlangen überstanden und Trainings', () => {
  it('zählt nur Anzahl, nie Minuten', () => {
    const r = detectBadges(1, 10, []);
    expect(r.newKeys).toEqual(['c1', 'w1', 'w10']);
    expect(r.celebrate).toEqual({ kind: 'craving', n: 1 });
    expect(detectBadges(1, 10, r.newKeys).celebrate).toBeNull();
  });
  it('Liste zum Anzeigen', () => {
    const list = badgeList({ bestDays: 8, saved: 60, cravings: 0, trainings: 3, hasMoney: true });
    expect(list.filter((b) => b.reached).map((b) => b.key)).toEqual(['d1', 'd7', 'm10', 'm50', 'w1']);
    expect(badgeList({ bestDays: 0, saved: 0, cravings: 0, trainings: 0, hasMoney: false }).some((b) => b.kind === 'money')).toBe(false);
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
      id: 'g1', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', perDay: 1, price: 2, mode: 'quit',
      startAt: new Date(2026, 9, 1, 8).toISOString(), createdAt: '', updatedAt: '',
    };
    const ws: Workout[] = [
      { id: 'a', day: '2026-10-20', at: '', sport: 'laufen', minutes: 40 },
      { id: 'b', day: '2026-10-26', at: '', sport: 'laufen', minutes: 30 },
    ];
    const r = lastWeekReview([g], [slip(new Date(2026, 9, 21, 12))], ws, new Date(2026, 9, 26, 9));
    expect(r?.week).toBe('2026-10-19');
    expect(r?.goodDays).toBe(6);
    expect(r?.daysTracked).toBe(7);
    // 25.10. hat eine Stunde mehr (Winterzeit): gespart wird nach echter Zeit
    expect(r?.saved).toBeCloseTo(7 * 2 + 2 / 24 - 2, 5);
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
