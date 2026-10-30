import { describe, expect, it } from 'vitest';
import { backupDue, installHint } from './reminders';

describe('Erinnerungen', () => {
  it('Sicherung alle 14 Tage, gezählt ab Start, letzter Sicherung oder «Später»', () => {
    expect(backupDue('2026-03-14', { firstStart: '2026-03-01' })).toBe(false);
    expect(backupDue('2026-03-15', { firstStart: '2026-03-01' })).toBe(true);
    expect(backupDue('2026-03-15', { firstStart: '2026-03-01', lastBackup: '2026-03-10' })).toBe(false);
    expect(backupDue('2026-03-24', { firstStart: '2026-03-01', lastBackup: '2026-03-10' })).toBe(true);
    expect(backupDue('2026-03-24', { firstStart: '2026-03-01', lastBackup: '2026-03-10', snoozed: '2026-03-20' })).toBe(false);
    expect(backupDue('2026-03-24', {})).toBe(false);
  });
  it('Installieren ab dem 3. Check-in: iPhone mit Anleitung, Android mit eigenem Knopf, sonst nichts', () => {
    const base = { checkins: 3, standalone: false, seen: false, ios: false, canPrompt: true };
    expect(installHint({ ...base, checkins: 2 })).toBeNull();
    expect(installHint(base)).toBe('button');
    expect(installHint({ ...base, ios: true, canPrompt: false })).toBe('ios');
    expect(installHint({ ...base, canPrompt: false })).toBeNull();
    expect(installHint({ ...base, standalone: true })).toBeNull();
    expect(installHint({ ...base, seen: true })).toBeNull();
  });
});
