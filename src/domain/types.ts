export type Mode = 'quit' | 'reduce';

export interface Goal {
  id: string;
  templateKey: string;
  name: string;
  emoji: string;
  unit: string; // Einzahl/Mehrzahl einfach: "Zigaretten"
  perDay: number; // normale Menge pro Tag vor dem Start
  price: number; // CHF pro Einheit
  sugarG?: number; // pro Einheit
  caffeineMg?: number; // pro Einheit
  mode: Mode;
  startAt: string; // ISO
  // Reduktionsplan
  targetPerDay?: number; // Ziel am Ende (meist 0)
  planWeeks?: number;
  planExtraWeeks?: number; // "Stufe verlängern"
  why?: string;
  /** Challenge von einem Link (#c=mate-14): so viele Tage */
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

export interface CheckIn {
  id: string;
  goalId: string;
  day: string; // YYYY-MM-DD
  mood: 1 | 2 | 3;
  /** Kurz-Tagebuch, privat, nie auf Teilen-Karten */
  note?: string;
}

/** «Wie stark ist das Verlangen jetzt?» nach dem Kurz-Bewegen. Privat, 1 = kaum, 5 = sehr stark. */
export interface CravingEntry {
  id: string;
  at: string; // ISO
  level: number;
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
