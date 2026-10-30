import type { CheckIn, Goal, UseEvent } from './types';
import { effortOf, type Workout } from './sport';
import { goalSummary } from './stats';
import { app } from '../i18n/de-CH';

// CSV für Excel in der Schweiz: Semikolon als Trenner, Punkt als Dezimalzeichen, UTF-8 mit BOM.
const SEP = ';';
const BOM = String.fromCharCode(0xfeff);

function cell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'number' ? String(+v.toFixed(2)) : v;
  // Formeln nie ausführen lassen (CSV-Injection), Trenner und Anführungszeichen schützen
  const safe = /^[=+\-@]/.test(s) && typeof v !== 'number' ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(rows: (string | number | undefined | null)[][]): string {
  return BOM + rows.map((r) => r.map(cell).join(SEP)).join('\r\n') + '\r\n';
}

const L = app.csv;

/** Ein Tag pro Zeile und Gewohnheit. Ausrutscher-Auslöser bleiben draussen. */
export function daysCsv(goals: Goal[], events: UseEvent[], checkins: CheckIn[], now: Date): string {
  const rows: (string | number | undefined)[][] = [[...L.days]];
  for (const g of goals) {
    const st = goalSummary(g, events, now);
    for (const d of st.days) {
      const mood = checkins.find((c) => c.day === d.day)?.mood;
      rows.push([d.day, g.name, d.units, g.mode === 'reduce' ? d.limit : 0, d.today ? L.running : d.win ? L.yes : L.no, mood ? app.heute.moods[mood] : '']);
    }
  }
  return toCsv(rows);
}

export function workoutsCsv(workouts: Workout[], sportName: (key: string) => string): string {
  const rows: (string | number | undefined)[][] = [[...L.workouts]];
  for (const w of [...workouts].sort((a, b) => a.day.localeCompare(b.day))) {
    rows.push([w.day, w.rest ? '' : sportName(w.sport), w.rest ? 0 : w.minutes, w.distanceKm, effortOf(w.rpe) ? app.sport.efforts[effortOf(w.rpe)!] : '', w.rest ? L.yes : L.no]);
  }
  return toCsv(rows);
}
