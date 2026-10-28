import { afterEach, describe, expect, it, vi } from 'vitest';
import { levelAfterFps, levelFromHints, resolveLevel, watchIdle, IDLE_MS } from './fx-level';

describe('Effektstufen', () => {
  it('reduzierte Bewegung oder Datensparen: tief', () => {
    expect(levelFromHints({ reduced: true, saveData: false, cores: 8, memory: 8 })).toBe('tief');
    expect(levelFromHints({ reduced: false, saveData: true, cores: 8, memory: 8 })).toBe('tief');
  });
  it('schwache Geräte: mittel oder tief; unbekannte Werte zählen nicht', () => {
    expect(levelFromHints({ reduced: false, saveData: false, cores: 2, memory: 8 })).toBe('tief');
    expect(levelFromHints({ reduced: false, saveData: false, cores: 8, memory: 2 })).toBe('mittel');
    expect(levelFromHints({ reduced: false, saveData: false, cores: 3 })).toBe('mittel');
    expect(levelFromHints({ reduced: false, saveData: false })).toBe('hoch');
  });
  it('Bildraten-Messung: unter 45 eine Stufe tiefer, unter 25 tief', () => {
    expect(levelAfterFps('hoch', 60)).toBe('hoch');
    expect(levelAfterFps('hoch', 40)).toBe('mittel');
    expect(levelAfterFps('mittel', 40)).toBe('tief');
    expect(levelAfterFps('hoch', 20)).toBe('tief');
  });
  it('die Wahl im Profil hat Vorrang, auch vor der Systemeinstellung', () => {
    expect(resolveLevel('hoch', 'tief')).toBe('hoch');
    expect(resolveLevel('tief', 'hoch')).toBe('tief');
    expect(resolveLevel('auto', 'hoch', 'mittel')).toBe('mittel');
    expect(resolveLevel('auto', 'tief', 'mittel')).toBe('tief');
  });
});

describe('Pause nach 20 Sekunden ohne Eingabe', () => {
  afterEach(() => vi.useRealTimers());
  it('meldet Ruhe nach 20 Sekunden und Aktivität bei der nächsten Eingabe', () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const seen: boolean[] = [];
    const stop = watchIdle((v) => seen.push(v), IDLE_MS, target);
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true]);
    target.dispatchEvent(new Event('pointermove'));
    expect(seen).toEqual([true, false]);
    vi.advanceTimersByTime(10_000);
    target.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(seen).toEqual([true, false]);
    stop();
    vi.advanceTimersByTime(IDLE_MS);
    expect(seen).toEqual([true, false]);
  });
});
