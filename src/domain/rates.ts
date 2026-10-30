// Menge und Preis als Verlauf: Änderungen gelten ab heute, die Vergangenheit bleibt.
import type { Goal, Rate } from './types';
import { dayKey } from './time';
import { templateByKey } from './templates';

export const startDayOf = (goal: Goal): string => dayKey(new Date(goal.startAt));

/** Rate, die an diesem Kalendertag gilt (vor der ersten: die erste). */
export function rateOn(goal: Goal, day: string): Rate {
  let r = goal.rates[0];
  for (const x of goal.rates) if (x.validFrom <= day) r = x;
  return r;
}

/** Die Menge vor dem Start: Basis für den Reduktionsplan. */
export const baseRate = (goal: Goal): Rate => goal.rates[0];

/** Gibt es Geld zu zählen? (Social Media zählt Zeit, eigene Gewohnheiten oft ohne Preis) */
export function hasMoney(goal: Goal): boolean {
  return !templateByKey(goal.templateKey).timeBased && goal.rates.some((r) => r.price > 0);
}

/** Sortiert, ein Eintrag pro Tag (der spätere gewinnt), nie leer. */
export function normalizeRates(rates: Rate[], startDay: string): Rate[] {
  const byDay = new Map<string, Rate>();
  for (const r of [...rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom))) {
    const day = r.validFrom < startDay ? startDay : r.validFrom;
    byDay.set(day, { ...r, validFrom: day });
  }
  const out = [...byDay.values()].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return out.length ? out : [{ validFrom: startDay, perDay: 0, price: 0 }];
}

/**
 * Neue Menge und neuen Preis übernehmen.
 * Normal: ab heute (neuer Eintrag im Verlauf). «Rückwirkend korrigieren»: die gerade gültige Rate
 * wird überschrieben, so als wäre der Tippfehler nie passiert.
 */
export function changeRate(goal: Goal, next: { perDay: number; price: number }, today: string, retro: boolean): Rate[] {
  const start = startDayOf(goal);
  if (retro) {
    const current = rateOn(goal, today);
    return normalizeRates(
      goal.rates.map((r) => (r === current ? { ...r, perDay: next.perDay, price: next.price } : r)),
      start,
    );
  }
  const from = today < start ? start : today;
  return normalizeRates([...goal.rates.filter((r) => r.validFrom !== from), { validFrom: from, ...next }], start);
}
