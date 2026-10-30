export type Mode = 'quit' | 'reduce';

/**
 * Menge und Preis ab einem Kalendertag. Eine Änderung gilt ab heute, die Vergangenheit bleibt.
 * Die erste Rate beginnt am Starttag.
 */
export interface Rate {
  validFrom: string; // YYYY-MM-DD
  perDay: number; // normale Menge pro Tag (Basis)
  price: number; // CHF pro Einheit
}

export interface Goal {
  id: string;
  templateKey: string;
  name: string;
  emoji: string;
  unit: string; // Mehrzahl: "Zigaretten", "Tassen"
  /** Einzahl für «+1 Tasse». Fehlt sie, wird die Mehrzahl genommen. */
  unitOne?: string;
  /** Verlauf von Menge und Preis, nach validFrom sortiert, mindestens ein Eintrag */
  rates: Rate[];
  sugarG?: number; // pro Einheit
  caffeineMg?: number; // pro Einheit
  mode: Mode;
  startAt: string; // ISO
  // Reduktionsplan
  targetPerDay?: number; // Ziel am Ende, frei wählbar (z. B. 1 statt 0)
  planWeeks?: number;
  /** Tage, an denen «Stufe verlängern» gedrückt wurde. Jeder hält die laufende Stufe 7 Tage länger. */
  planExtensions?: string[];
  why?: string;
  /** Challenge von einem Link (#challenge=mate-30): so viele Tage */
  challengeDays?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface UseEvent {
  id: string;
  goalId: string;
  at: string; // ISO
  units: number;
  trigger?: string;
  kind: 'slip' | 'log'; // slip = Ausrutscher (Aufhör-Modus), log = Zählen (Reduktion)
  updatedAt: string;
}

/** Check-in: einmal pro Tag (nicht pro Gewohnheit), änderbar. */
export interface CheckIn {
  id: string;
  day: string; // YYYY-MM-DD
  mood: 1 | 2 | 3;
  /** Kurz-Tagebuch, privat, nie auf Teilen-Karten */
  note?: string;
}

/** «Verlangen überstanden», z. B. nach dem Kurz-Bewegen. Privat. Stärke 1 = kaum, 5 = sehr stark, falls eingeschätzt. */
export interface CravingEntry {
  id: string;
  at: string; // ISO
  level?: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  amount: number;
}

/** Wenn-dann-Plan: «Wenn ich Stress habe, dann atme ich 3 Minuten.» Privat. */
export interface IfThenPlan {
  id: string;
  when: string;
  then: string;
}
