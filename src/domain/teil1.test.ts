// Teil 1: Rechenregeln, eine Funktion pro Thema. Läuft mit TZ=Europe/Zurich (vite.config.ts).
import { describe, expect, it } from 'vitest';
import type { Goal, UseEvent } from './types';
import { goalSummary, totalSaved } from './stats';
import { canExtend, extendStage, limitForDay, planStages, planSteps, stageOn } from './reduction';
import { changeRate, rateOn } from './rates';
import { nextDayMilestone, reconcileMilestones, migrateSeenKeys } from './milestones';
import { checkGoalInput } from './validate';
import { mergeCheckins, migrateGoal, migratePersisted, PERSIST_VERSION, splitCravingMoves } from './persist';
import { isDuplicate } from './sport';
import { lastWeekReview } from './insights';
import { app, words } from '../i18n/de-CH';

const at = (s: string) => new Date(s);
let n = 0;
const ev = (goalId: string, iso: string, units = 1, kind: UseEvent['kind'] = 'slip'): UseEvent => ({ id: `e${n++}`, goalId, at: at(iso).toISOString(), units, kind, updatedAt: iso });

function goal(p: Partial<Goal> & { start: string; perDay?: number; price?: number }): Goal {
  const { start, perDay = 2, price = 1, ...rest } = p;
  return {
    id: 'g',
    templateKey: 'mate',
    name: 'Mate',
    emoji: '🧉',
    unit: 'Mate',
    rates: [{ validFrom: start.slice(0, 10), perDay, price }],
    mode: 'quit',
    startAt: at(start).toISOString(),
    createdAt: start,
    updatedAt: start,
    ...rest,
  };
}

describe('Serie, gute Tage und «Seit X Tagen»', () => {
  const g = goal({ start: '2026-03-02T08:00:00' });

  it('heute zählt mit, solange heute gut ist; Serie und gute Tage folgen derselben Regel', () => {
    const s = goalSummary(g, [], at('2026-03-04T10:00:00'));
    expect(s.totalDays).toBe(3);
    expect(s.streak).toBe(3);
    expect(s.goodDays).toBe(3);
    expect(s.bestStreak).toBe(3);
  });

  it('Ausrutscher um 20:00: um 22:00 ist die Serie sofort 0, am nächsten Morgen 1', () => {
    const slip = [ev('g', '2026-03-04T20:00:00')];
    const evening = goalSummary(g, slip, at('2026-03-04T22:00:00'));
    expect(evening.streak).toBe(0);
    expect(evening.goodDays).toBe(2);
    expect(evening.bestStreak).toBe(2);
    const morning = goalSummary(g, slip, at('2026-03-05T07:00:00'));
    expect(morning.streak).toBe(1);
    expect(morning.goodDays).toBe(3);
    expect(morning.bestStreak).toBeGreaterThanOrEqual(morning.streak);
  });

  it('die längste Serie ist nie kleiner als die aktuelle', () => {
    const s = goalSummary(g, [ev('g', '2026-03-03T12:00:00')], at('2026-03-20T09:00:00'));
    expect(s.streak).toBe(17);
    expect(s.bestStreak).toBe(17);
  });

  it('Einträge vor dem Start und in der Zukunft zählen nicht', () => {
    const s = goalSummary(g, [ev('g', '2026-03-01T12:00:00'), ev('g', '2026-03-04T23:00:00')], at('2026-03-04T10:00:00'));
    expect(s.streak).toBe(3);
  });
});

describe('Gespart: eine Formel für Aufhören und Reduzieren', () => {
  it('pro Tag (Basis − Konsum) × Preis, Start- und heutiger Tag anteilig nach echter Zeit', () => {
    // 2 pro Tag zu CHF 1, Start um 12:00: am Starttag um Mitternacht CHF 1, zwei volle Tage später CHF 5
    const g = goal({ start: '2026-03-02T12:00:00' });
    expect(goalSummary(g, [], at('2026-03-03T00:00:00')).saved).toBe(1);
    expect(goalSummary(g, [], at('2026-03-05T00:00:00')).saved).toBe(5);
  });

  it('Reduzieren rechnet gleich, Mehrkonsum zählt negativ', () => {
    const q = goal({ start: '2026-03-02T00:00:00', perDay: 2, price: 1 });
    const r = { ...q, mode: 'reduce' as const, targetPerDay: 0, planWeeks: 2 };
    const used = [ev('g', '2026-03-02T09:00:00', 1, 'log')];
    const end = at('2026-03-03T00:00:00');
    expect(goalSummary(r, used, end).saved).toBe(1);
    expect(goalSummary(q, used, end).saved).toBe(1);
    const tooMuch = [ev('g', '2026-03-02T09:00:00', 5, 'log')];
    expect(goalSummary(r, tooMuch, end).saved).toBe(-3);
  });

  it('Preisänderung gilt ab heute, die Vergangenheit bleibt; rückwirkend korrigiert sie alles', () => {
    const g = goal({ start: '2026-03-02T00:00:00', perDay: 1, price: 2 });
    const end = at('2026-03-06T00:00:00'); // 4 volle Tage
    expect(goalSummary(g, [], end).saved).toBe(8);
    const fromToday = { ...g, rates: changeRate(g, { perDay: 1, price: 5 }, '2026-03-04', false) };
    expect(fromToday.rates).toHaveLength(2);
    expect(rateOn(fromToday, '2026-03-03').price).toBe(2);
    expect(goalSummary(fromToday, [], end).saved).toBe(2 + 2 + 5 + 5);
    const retro = { ...g, rates: changeRate(g, { perDay: 1, price: 5 }, '2026-03-04', true) };
    expect(retro.rates).toHaveLength(1);
    expect(goalSummary(retro, [], end).saved).toBe(20);
  });

  it('«Insgesamt» ist genau die Summe der auf Rappen gerundeten Gewohnheiten', () => {
    const a = goal({ start: '2026-03-02T07:13:00', perDay: 3, price: 0.35 });
    const b = { ...goal({ start: '2026-03-01T19:41:00', perDay: 1.5, price: 1.9 }), id: 'b' };
    const now = at('2026-03-09T16:27:31');
    const sa = goalSummary(a, [], now).saved;
    const sb = goalSummary(b, [], now).saved;
    expect(Math.round(sa * 100)).toBe(sa * 100);
    expect(totalSaved([a, b], [], now)).toBe(Math.round((sa + sb) * 100) / 100);
  });

  it('Sommerzeit: der 23-Stunden-Tag zählt als ganzer Tag, nicht als 23/24', () => {
    const g = goal({ start: '2026-03-28T00:00:00', perDay: 24, price: 1 });
    // 29. März 2026: Umstellung auf Sommerzeit
    expect(goalSummary(g, [], at('2026-03-30T00:00:00')).saved).toBe(48);
    expect(goalSummary(g, [], at('2026-03-30T00:00:00')).totalDays).toBe(3);
  });

  it('Winterzeit: der 25-Stunden-Tag zählt ebenfalls als ganzer Tag', () => {
    const g = goal({ start: '2026-10-24T00:00:00', perDay: 25, price: 1 });
    expect(goalSummary(g, [], at('2026-10-26T00:00:00')).saved).toBe(50);
  });
});

describe('Reduktion', () => {
  it('der Plan hat keine doppelten Stufen und endet beim gewählten Ziel', () => {
    for (const [start, target, weeks] of [
      [3, 0, 8],
      [4, 1, 6],
      [10, 2, 12],
      [1.5, 0, 6],
    ]) {
      const steps = planSteps(start, target, weeks, start % 1 ? 0.5 : 1);
      expect(new Set(steps).size, `${start}→${target}`).toBe(steps.length);
      expect(steps[steps.length - 1]).toBe(target);
      for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    }
  });

  it('das Ziel ist frei wählbar, z. B. 1 statt 0', () => {
    const g = { ...goal({ start: '2026-03-02T08:00:00', perDay: 4 }), mode: 'reduce' as const, targetPerDay: 1, planWeeks: 3 };
    expect(planSteps(4, 1, 3)).toEqual([3, 2, 1]);
    expect(limitForDay(g, '2026-04-30')).toBe(1);
  });

  it('«Stufe verlängern» hält die aktuelle Stufe ab heute 7 Tage länger, geht nie rückwärts, höchstens einmal pro Woche', () => {
    const g = { ...goal({ start: '2026-03-02T08:00:00', perDay: 4 }), mode: 'reduce' as const, targetPerDay: 0, planWeeks: 4 };
    // Woche 2 beginnt am 9. März
    expect(stageOn(g, '2026-03-11').index).toBe(1);
    const ext = { ...g, planExtensions: extendStage(g, '2026-03-11') };
    expect(stageOn(ext, '2026-03-11').index).toBe(1);
    expect(stageOn(ext, '2026-03-17').index).toBe(1); // wäre ohne Verlängerung Woche 3
    expect(stageOn(ext, '2026-03-23').index).toBe(2);
    expect(planStages(ext)[1].extended).toBe(true);
    // Vergangene Tage bleiben, wie sie waren
    expect(stageOn(ext, '2026-03-05').index).toBe(0);
    expect(canExtend(ext, '2026-03-14')).toBe(false);
    expect(extendStage(ext, '2026-03-14')).toEqual(ext.planExtensions);
    expect(canExtend(ext, '2026-03-18')).toBe(true);
  });

  it('Anzeige «4 von 5 Tagen im Plan» für die laufende Stufe, mit «verlängert bis …»', () => {
    const g = { ...goal({ start: '2026-03-02T08:00:00', perDay: 4 }), mode: 'reduce' as const, targetPerDay: 0, planWeeks: 4, planExtensions: ['2026-03-10'] };
    const events = [ev('g', '2026-03-11T09:00:00', 9, 'log')];
    const s = goalSummary(g, events, at('2026-03-13T10:00:00'));
    expect(s.plan).toMatchObject({ week: 2, daysSoFar: 5, inPlan: 4, extendedUntil: '2026-03-22' });
    expect(app.heute.inPlan(4, 5)).toBe('4 von 5 Tagen im Plan');
    expect(app.heute.planExtended(2, words.date('2026-03-22'))).toContain('Woche 2, verlängert bis');
  });
});

describe('Meilensteine', () => {
  it('nur noch Tage 1/7/30/100/365, CHF 10/50/100/500 und «Verlangen überstanden»', () => {
    expect(nextDayMilestone(3)).toMatchObject({ prev: 1, next: 7, left: 4 });
    expect(nextDayMilestone(400).next).toBeNull();
    expect(migrateSeenKeys(['d7@abc', 't90000000@x', 'm1000', 'w10', 'c10', 'c1', 'm50'])).toEqual(expect.arrayContaining(['d7', 'd1', 'c1', 'm50']));
    expect(migrateSeenKeys(['m1000', 'w10', 'c10'])).toEqual([]);
  });

  it('fällt ein Wert durch eine Korrektur unter die Grenze, wird die Feier zurückgesetzt', () => {
    const first = reconcileMilestones(8, 60, [], true);
    expect(first.celebrate).toEqual({ kind: 'days', n: 7 });
    expect(first.keep.sort()).toEqual(['d1', 'd7', 'm10', 'm50'].sort());
    const after = reconcileMilestones(2, 40, first.keep, true);
    expect(after.keep.sort()).toEqual(['d1', 'm10'].sort());
    expect(after.changed).toBe(true);
    expect(after.celebrate).toBeNull();
    const again = reconcileMilestones(7, 40, after.keep, true);
    expect(again.celebrate).toEqual({ kind: 'days', n: 7 });
  });
});

describe('Eingaben prüfen', () => {
  const today = '2026-03-20';
  it('Preis 0 bis 100, Menge 0.5 bis 200, Fehler pro Feld', () => {
    expect(checkGoalInput({ perDay: '3', price: '1.50' }, today, { needsPrice: true }).ok).toBe(true);
    expect(checkGoalInput({ perDay: '0.4', price: '1' }, today, { needsPrice: true }).errors.perDay).toBeTruthy();
    expect(checkGoalInput({ perDay: '201', price: '1' }, today, { needsPrice: true }).errors.perDay).toBeTruthy();
    expect(checkGoalInput({ perDay: '3', price: '100.01' }, today, { needsPrice: true }).errors.price).toBeTruthy();
    expect(checkGoalInput({ perDay: '3', price: 'abc' }, today, { needsPrice: true }).errors.price).toBeTruthy();
    expect(checkGoalInput({ perDay: '3', price: '2,5' }, today, { needsPrice: true }).values.price).toBe(2.5);
    expect(checkGoalInput({ perDay: '3', price: 'x' }, today, { needsPrice: false }).ok).toBe(true);
  });
  it('Startdatum nie in der Zukunft, mehr als 30 Tage zurück nur mit Warnung', () => {
    expect(checkGoalInput({ perDay: '3', price: '1', startDay: '2026-03-21' }, today, { needsPrice: true }).errors.startDay).toBeTruthy();
    const old = checkGoalInput({ perDay: '3', price: '1', startDay: '2026-01-01' }, today, { needsPrice: true });
    expect(old.ok).toBe(true);
    expect(old.warnings.startDay).toContain('78 Tage');
    expect(checkGoalInput({ perDay: '3', price: '1', startDay: '2026-03-01' }, today, { needsPrice: true }).warnings.startDay).toBeUndefined();
  });
  it('das Reduktionsziel muss kleiner sein als die Menge', () => {
    expect(checkGoalInput({ perDay: '3', price: '1', target: '3' }, today, { needsPrice: true }).errors.target).toBeTruthy();
    expect(checkGoalInput({ perDay: '3', price: '1', target: '1' }, today, { needsPrice: true }).values.target).toBe(1);
  });
});

describe('Migration auf Version 5', () => {
  it('Menge und Preis werden zum Verlauf ab dem Starttag, Verlängerungen bleiben gleichwertig', () => {
    const old = { id: 'g', templateKey: 'kaffee', name: 'Kaffee', unit: 'Tassen', perDay: 4, price: 1.2, mode: 'reduce', planWeeks: 4, planExtraWeeks: 1, startAt: '2026-03-02T07:00:00.000Z' };
    const g = migrateGoal(old) as Goal;
    expect(g.rates).toEqual([{ validFrom: '2026-03-02', perDay: 4, price: 1.2 }]);
    expect(g.planExtensions).toEqual(['2026-03-02']);
    expect(g.unitOne).toBe('Tasse');
    expect('perDay' in g || 'price' in g || 'planExtraWeeks' in g).toBe(false);
    // Früher: Woche 2 wegen einer Extra-Woche erst ab Tag 15
    expect(stageOn({ ...g, targetPerDay: 0 }, '2026-03-12').index).toBe(0);
    expect(stageOn({ ...g, targetPerDay: 0 }, '2026-03-16').index).toBe(1);
  });

  it('Check-ins werden pro Tag zusammengeführt, Notizen bleiben', () => {
    const out = mergeCheckins([
      { id: 'a', goalId: 'g1', day: '2026-03-02', mood: 1, note: 'müde' },
      { id: 'b', goalId: 'g2', day: '2026-03-02', mood: 3, note: 'Sport hilft' },
      { id: 'c', goalId: 'g1', day: '2026-03-03', mood: 2 },
    ]) as { day: string; mood: number; note?: string; goalId?: string }[];
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ day: '2026-03-02', mood: 3, note: 'müde · Sport hilft' });
    expect(out[0].goalId).toBeUndefined();
  });

  it('«Kurz bewegen» war ein Training und wird zu «Verlangen überstanden», ohne Doppelte', () => {
    const r = splitCravingMoves(
      [
        { id: 'w1', day: '2026-03-02', at: '2026-03-02T20:00:00.000Z', sport: 'bewegung', minutes: 3, trigger: 'craving' },
        { id: 'w2', day: '2026-03-03', at: '2026-03-03T20:00:00.000Z', sport: 'bewegung', minutes: 3, trigger: 'craving' },
        { id: 'w3', day: '2026-03-03', at: '2026-03-03T18:00:00.000Z', sport: 'laufen', minutes: 30 },
      ],
      [{ id: 'c1', at: '2026-03-02T20:03:00.000Z', level: 3 }],
    );
    expect(r.workouts).toHaveLength(1);
    expect(r.cravings).toHaveLength(2);
  });

  it('gespeicherte Daten aus v4 kommen vollständig im neuen Format an', () => {
    const v4 = {
      goals: [{ id: 'g', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', perDay: 1, price: 1.9, mode: 'quit', startAt: '2026-03-02T08:00:00.000Z' }],
      checkins: [{ id: 'c', goalId: 'g', day: '2026-03-02', mood: 2 }],
      workouts: [],
      cravings: [],
      seenMilestones: { g: ['d7@start', 'm50'], _alle: ['c1', 'w1'] },
      fxLevel: 'auto',
    };
    const m = migratePersisted(v4, 4);
    expect(PERSIST_VERSION).toBe(5);
    expect((m.goals as Goal[])[0].rates[0]).toEqual({ validFrom: '2026-03-02', perDay: 1, price: 1.9 });
    expect(m.seenMilestones).toEqual({ g: ['d7', 'm50'], _alle: ['c1'] });
    expect((m.checkins as { goalId?: string }[])[0].goalId).toBeUndefined();
  });
});

describe('Sport und Wochenrückblick', () => {
  it('doppelte Einträge (gleiche Sportart, Dauer, Tag) werden erkannt', () => {
    const list = [{ id: 'a', day: '2026-03-02', at: '', sport: 'laufen', minutes: 30 }];
    expect(isDuplicate(list, { day: '2026-03-02', sport: 'laufen', minutes: 30 })).toBe(true);
    expect(isDuplicate(list, { day: '2026-03-02', sport: 'laufen', minutes: 35 })).toBe(false);
    expect(isDuplicate(list, { day: '2026-03-03', sport: 'laufen', minutes: 30 })).toBe(false);
  });

  it('Wochenrückblick klar pro Gewohnheit: «Snus: 7 von 7 · Kaffee: 5 von 7 im Plan»', () => {
    const snus = { ...goal({ start: '2026-02-20T08:00:00' }), id: 's', name: 'Snus' };
    const kaffee = { ...goal({ start: '2026-02-20T08:00:00', perDay: 4 }), id: 'k', name: 'Kaffee', mode: 'reduce' as const, targetPerDay: 0, planWeeks: 8 };
    // Woche 2. bis 8. März: an zwei Tagen deutlich zu viel Kaffee
    const events = [ev('k', '2026-03-03T09:00:00', 9, 'log'), ev('k', '2026-03-05T09:00:00', 9, 'log')];
    const r = lastWeekReview([snus, kaffee], events, [], at('2026-03-09T10:00:00'))!;
    const text = app.review.lines(r.perGoal.map((g) => app.review.line(g.name, g.good, g.of, g.mode === 'reduce')));
    expect(text).toBe('Snus: 7 von 7 · Kaffee: 5 von 7 im Plan');
  });
});

describe('Grammatik', () => {
  it('«Deine 7 guten Tage», «Dein 1 guter Tag», «+1 Tasse»', () => {
    expect(app.slip.keep(7)).toBe('Deine 7 guten Tage bleiben.');
    expect(app.slip.keep(1)).toBe('Dein 1 guter Tag bleibt.');
    expect(app.heute.plusOne('Tasse')).toBe('+1 Tasse');
    expect(app.heute.sinceQuit(1, 'Mate')).toBe('Seit 1 Tag ohne Mate');
    expect(app.heute.sinceQuit(25, 'Mate')).toBe('Seit 25 Tagen ohne Mate');
  });
});
