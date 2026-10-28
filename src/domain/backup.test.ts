import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, serializeBackup, validateImport, type BackupData } from './backup';
import { migratePersisted, PERSIST_VERSION } from './persist';

const NOW = new Date(2026, 9, 24, 12, 0);

const sample = (): BackupData => ({
  goals: [
    {
      id: 'g1', templateKey: 'mate', name: 'Mate', emoji: '🧉', unit: 'Mate', perDay: 1, price: 1.9, mode: 'quit',
      challengeDays: 14,
      startAt: '2026-09-10T06:00:00.000Z', createdAt: '2026-09-10T06:00:00.000Z', updatedAt: '2026-09-10T06:00:00.000Z',
    },
  ],
  events: [{ id: 'e1', goalId: 'g1', at: '2026-10-01T10:00:00.000Z', units: 1, kind: 'slip', trigger: 'Stress', updatedAt: '2026-10-01T10:00:00.000Z' }],
  checkins: [{ id: 'c1', goalId: 'g1', day: '2026-10-20', mood: 3, note: 'Gut geschlafen' }],
  savings: [{ id: 's1', name: 'Laufschuhe', amount: 150 }],
  workouts: [
    { id: 'w1', day: '2026-10-21', at: '2026-10-21T16:00:00.000Z', sport: 'laufen', minutes: 40, distanceKm: 7, rpe: 6, feeling: 3 },
    { id: 'w2', day: '2026-10-22', at: '2026-10-22T18:00:00.000Z', sport: 'andere', minutes: 0, rest: true },
  ],
  cravings: [{ id: 'k1', at: '2026-10-22T19:00:00.000Z', level: 2 }],
  plans: [{ id: 'p1', when: 'Wenn ich Stress habe', then: 'atme ich eine Minute' }],
  sportGoalMin: 180,
});

const strip = (d: BackupData) => JSON.parse(JSON.stringify(d));

describe('Sicherung prüfen', () => {
  it('eigene Sicherung kommt unverändert zurück', () => {
    const r = validateImport(serializeBackup(sample()), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(strip(r.data)).toEqual(strip(sample()));
      expect(r.dropped).toBe(0);
    }
  });

  it('lehnt kaputtes JSON, fremde Dateien und Sicherungen ohne gültiges Ziel ab', () => {
    expect(validateImport('{nope', NOW).ok).toBe(false);
    expect(validateImport(JSON.stringify({ foo: 1 }), NOW).ok).toBe(false);
    const d = sample();
    d.goals[0].mode = 'irgendwas' as never;
    expect(validateImport(serializeBackup(d), NOW)).toMatchObject({ ok: false, error: 'In dieser Sicherung ist keine gültige Gewohnheit.' });
  });

  it('lehnt mehr als 2 MB ab', () => {
    const big = JSON.stringify({ goals: [], pad: 'x'.repeat(MAX_IMPORT_BYTES) });
    expect(validateImport(big, NOW)).toMatchObject({ ok: false, error: 'Diese Sicherung ist grösser als 2 MB.' });
  });

  it('verwirft ungültige Felder einzeln und zählt sie', () => {
    const d = strip(sample());
    d.events.push({ id: 'e2', goalId: 'gibts-nicht', at: '2026-10-02T10:00:00Z', units: 1, kind: 'slip' }); // kein Ziel
    d.events.push({ id: 'e3', goalId: 'g1', at: 'gestern', units: 1, kind: 'slip' }); // Datum
    d.events.push({ id: 'e4', goalId: 'g1', at: '2026-10-02T10:00:00Z', units: -3, kind: 'slip' }); // Menge
    d.checkins.push({ id: 'c2', goalId: 'g1', day: '2026-02-31', mood: 2 }); // Tag gibt es nicht
    d.workouts.push({ id: 'w3', day: '2026-10-22', sport: 'quidditch', minutes: 30 }); // Sportart
    d.workouts.push({ id: 'w4', day: '2026-10-22', sport: 'laufen', minutes: 5000 }); // Dauer
    d.workouts.push({ id: 'w1', day: '2026-10-22', sport: 'laufen', minutes: 30 }); // doppelte ID
    d.cravings.push({ id: 'k2', at: '2026-10-22T19:00:00Z', level: 9 }); // Stufe
    const r = validateImport(JSON.stringify(d), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dropped).toBe(8);
      expect(r.data.events).toHaveLength(1);
      expect(r.data.workouts.map((w) => w.id)).toEqual(['w1', 'w2']);
    }
  });

  it('Startdatum in der Zukunft oder älter als 5 Jahre ist ungültig', () => {
    const future = sample();
    future.goals[0].startAt = '2027-01-01T00:00:00Z';
    expect(validateImport(serializeBackup(future), NOW).ok).toBe(false);
    const old = sample();
    old.goals[0].startAt = '2020-01-01T00:00:00Z';
    expect(validateImport(serializeBackup(old), NOW).ok).toBe(false);
  });

  it('ergänzt fehlende Texte und begrenzt das Wochenziel auf 30 bis 600', () => {
    const d = strip(sample());
    delete d.goals[0].unit;
    delete d.goals[0].emoji;
    d.sportGoalMin = 5000;
    const r = validateImport(JSON.stringify(d), NOW);
    expect(r.ok && r.data.goals[0].unit).toBe('Mal');
    expect(r.ok && r.data.goals[0].emoji).toBe('✨');
    expect(r.ok && r.data.sportGoalMin).toBe(600);
  });
});

describe('Gespeicherte Daten migrieren', () => {
  it('v1 bekommt ein leeres Verlangen-Protokoll und ein gültiges Wochenziel', () => {
    const v1 = { goals: [{ id: 'g1' }], workouts: [], sportGoalMin: 1200, reduceEffects: true, irgendwas: 1, importData: 'x' };
    const m = migratePersisted(v1, 1);
    expect(m.cravings).toEqual([]);
    expect(m.sportGoalMin).toBe(600);
    expect(m.fxLevel).toBe('tief');
    expect('reduceEffects' in m).toBe(false);
    expect('irgendwas' in m).toBe(false);
    expect('importData' in m).toBe(false);
  });

  it('kaputte Daten werden zu leeren Listen', () => {
    const m = migratePersisted(null, 0);
    expect(m.goals).toEqual([]);
    expect(m.events).toEqual([]);
    expect(PERSIST_VERSION).toBe(4);
  });
});
