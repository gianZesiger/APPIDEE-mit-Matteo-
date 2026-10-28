// Kalendertage lokal rechnen, robust bei Sommer-/Winterzeit.

export const DAY_MS = 86_400_000;

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Anzahl Kalendertage zwischen zwei Tages-Schlüsseln (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

export function addDays(key: string, n: number): string {
  const p = parseDayKey(key);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Bruchteil des lokalen Tages, der schon vorbei ist (0..1). */
export function fractionOfDay(d: Date): number {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Math.min(1, Math.max(0, (d.getTime() - start) / (end - start)));
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
