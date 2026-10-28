import type { SavingsGoal } from './types';

export interface PotFill {
  pot: SavingsGoal;
  filled: number; // CHF in diesem Topf
  left: number; // CHF bis voll
  progress: number; // 0..1
  done: boolean;
}

/**
 * Wasserfall: Das Gesparte füllt die Sparziele der Reihe nach.
 * Erst wenn ein Topf voll ist, fliesst der Rest in den nächsten.
 */
export function allocatePots(total: number, pots: SavingsGoal[]): PotFill[] {
  let rest = Math.max(0, Number.isFinite(total) ? total : 0);
  return pots.map((pot) => {
    const filled = Math.min(rest, pot.amount);
    rest -= filled;
    const left = Math.max(0, pot.amount - filled);
    return { pot, filled, left, progress: pot.amount > 0 ? filled / pot.amount : 0, done: left < 0.005 };
  });
}

/** Der Topf, der gerade gefüllt wird (oder null, wenn alle voll sind). */
export function currentPot(fills: PotFill[]): PotFill | null {
  return fills.find((f) => !f.done) ?? null;
}

/** Verschiebt ein Sparziel in der Reihenfolge um eine Stelle. */
export function movePot(pots: SavingsGoal[], id: string, dir: -1 | 1): SavingsGoal[] {
  const i = pots.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pots.length) return pots;
  const next = [...pots];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
