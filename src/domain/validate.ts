// Eingaben prüfen: Fehler stehen direkt am Feld, nichts wird still übernommen.
import { daysBetween } from './time';
import { app } from '../i18n/de-CH';

const V = app.validation;

export const PRICE_MAX = 100;
export const PER_DAY_MIN = 0.5;
export const PER_DAY_MAX = 200;
export const START_WARN_DAYS = 30;

/** Zahl aus einem Eingabefeld (Komma oder Punkt). Leer oder ungültig: null. */
export function parseAmount(v: string): number | null {
  const s = v.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface GoalInput {
  perDay: string;
  price: string;
  startDay?: string; // YYYY-MM-DD
  target?: string; // Reduktionsziel
}

export interface GoalCheck {
  ok: boolean;
  values: { perDay: number; price: number; target: number };
  errors: Partial<Record<'perDay' | 'price' | 'startDay' | 'target', string>>;
  warnings: Partial<Record<'startDay', string>>;
}

export function checkGoalInput(input: GoalInput, today: string, opts: { needsPrice: boolean }): GoalCheck {
  const errors: GoalCheck['errors'] = {};
  const warnings: GoalCheck['warnings'] = {};
  const perDay = parseAmount(input.perDay);
  if (perDay === null) errors.perDay = V.number;
  else if (perDay < PER_DAY_MIN || perDay > PER_DAY_MAX) errors.perDay = V.perDay(PER_DAY_MIN, PER_DAY_MAX);

  let price = 0;
  if (opts.needsPrice) {
    const p = parseAmount(input.price);
    if (p === null) errors.price = V.number;
    else if (p > PRICE_MAX) errors.price = V.price(PRICE_MAX);
    else price = p;
  }

  let target = 0;
  if (input.target !== undefined && input.target.trim() !== '') {
    const t = parseAmount(input.target);
    if (t === null) errors.target = V.number;
    else if (perDay !== null && t >= perDay) errors.target = V.target;
    else target = t;
  }

  if (input.startDay !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDay)) errors.startDay = V.date;
    else {
      const back = daysBetween(input.startDay, today);
      if (back < 0) errors.startDay = V.future;
      else if (back > 5 * 365) errors.startDay = V.tooOld;
      else if (back > START_WARN_DAYS) warnings.startDay = V.longAgo(back);
    }
  }
  return { ok: Object.keys(errors).length === 0, values: { perDay: perDay ?? 0, price, target }, errors, warnings };
}
