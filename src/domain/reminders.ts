// Freundliche Hinweise auf «Heute»: Sicherung alle 14 Tage, Installieren nach dem 3. Check-in.
import { daysBetween } from './time';

export const BACKUP_EVERY_DAYS = 14;
export const INSTALL_AFTER_CHECKINS = 3;

/**
 * Ist eine Erinnerung an die Sicherung fällig? Gezählt wird ab dem spätesten von:
 * erster Start, letzte Sicherung, letztes «Später».
 */
export function backupDue(today: string, input: { firstStart?: string; lastBackup?: string; snoozed?: string }): boolean {
  const from = [input.firstStart, input.lastBackup, input.snoozed].filter((x): x is string => !!x).sort().pop();
  return !!from && daysBetween(from, today) >= BACKUP_EVERY_DAYS;
}

export type InstallWay = 'ios' | 'button' | null;

/** Installations-Hinweis ab dem 3. Check-in, nie in der installierten App und nur einmal. */
export function installHint(input: { checkins: number; standalone: boolean; seen: boolean; ios: boolean; canPrompt: boolean }): InstallWay {
  if (input.standalone || input.seen || input.checkins < INSTALL_AFTER_CHECKINS) return null;
  if (input.ios) return 'ios';
  return input.canPrompt ? 'button' : null;
}
