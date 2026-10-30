import { describe, expect, it } from 'vitest';
import { allocatePots, currentPot, movePot } from './savings';
import { moneyCompare } from './compare';
import { daysCsv, workoutsCsv } from './csv';
import { words } from '../i18n/de-CH';
import type { Goal } from './types';

const pots = [
  { id: 'a', name: 'Kino', amount: 20 },
  { id: 'b', name: 'Laufschuhe', amount: 150 },
  { id: 'c', name: 'Berge', amount: 300 },
];

describe('Sparziele als Wasserfall', () => {
  it('füllt der Reihe nach, der Rest fliesst weiter', () => {
    const f = allocatePots(100, pots);
    expect(f.map((x) => x.filled)).toEqual([20, 80, 0]);
    expect(f[0].done).toBe(true);
    expect(f[1].left).toBe(70);
    expect(currentPot(f)?.pot.id).toBe('b');
  });
  it('alles voll: kein aktueller Topf; negative Beträge zählen als 0', () => {
    expect(currentPot(allocatePots(1000, pots))).toBeNull();
    expect(allocatePots(-5, pots).every((x) => x.filled === 0)).toBe(true);
  });
  it('Reihenfolge ändern, an den Rändern passiert nichts', () => {
    expect(movePot(pots, 'b', -1).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(movePot(pots, 'a', -1)).toBe(pots);
    expect(movePot(pots, 'c', 1)).toBe(pots);
  });
});

describe('Alltagsvergleich', () => {
  it('nimmt das teuerste Ding, von dem es mindestens zwei gibt', () => {
    expect(moneyCompare(1095)).toEqual({ key: 'berge', count: 3 });
    expect(moneyCompare(320)).toEqual({ key: 'schuhe', count: 2 });
    expect(moneyCompare(40)).toEqual({ key: 'kino', count: 2 });
    expect(moneyCompare(1)).toBeNull();
  });
});

describe('Zeit in Worten, ohne Abkürzungen', () => {
  it('schreibt Stunden und Minuten aus', () => {
    expect(words.minutesLong(275)).toBe('4 Stunden 35 Minuten');
    expect(words.minutesLong(60)).toBe('1 Stunde');
    expect(words.minutesLong(1)).toBe('1 Minute');
    expect(words.sinceDat(25 * 86_400_000 + 5000)).toBe('25 Tagen');
    expect(words.sinceDat(86_400_000)).toBe('1 Tag');
    expect(words.week(1)).toBe('Woche 1');
    expect(words.exact(3_723_000)).toBe('1 Stunde, 2 Minuten, 3 Sekunden');
  });
});

describe('CSV-Export', () => {
  const now = new Date(2026, 9, 24, 12, 0);
  const goal: Goal = {
    id: 'g1', templateKey: 'mate', name: 'Mate; "Club"', emoji: '🧉', unit: 'Mate', rates: [{ validFrom: '2026-10-21', perDay: 1, price: 2 }], mode: 'quit',
    startAt: new Date(2026, 9, 21, 8).toISOString(), createdAt: '', updatedAt: '',
  };
  it('Semikolon, BOM, geschützte Felder, ein Tag pro Zeile', () => {
    const csv = daysCsv([goal], [{ id: 'e', goalId: 'g1', at: new Date(2026, 9, 22, 15).toISOString(), units: 1, kind: 'slip', trigger: 'Stress', updatedAt: '' }], [], now);
    expect(csv.startsWith(String.fromCharCode(0xfeff) + 'Datum;Gewohnheit;')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(1 + 4); // 21. bis 24. Oktober
    expect(lines[2]).toBe('2026-10-22;"Mate; ""Club""";1;0;nein;');
    expect(csv).not.toContain('Stress'); // Auslöser bleiben privat
  });
  it('Trainings mit Ruhetag und ohne Formeln', () => {
    const csv = workoutsCsv(
      [
        { id: 'w', day: '2026-10-20', at: '', sport: 'laufen', minutes: 40, distanceKm: 7.25 },
        { id: 'r', day: '2026-10-19', at: '', sport: 'andere', minutes: 0, rest: true },
      ],
      (k) => (k === 'laufen' ? '=Laufen' : k),
    );
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toBe('2026-10-19;;0;;;ja');
    expect(lines[2]).toBe("2026-10-20;'=Laufen;40;7.25;;nein");
  });
});

// Als Zeichencode, damit diese Datei die Prüfung selbst besteht
const SHARP_S = String.fromCharCode(0xdf);

describe('Schweizer Rechtschreibung', () => {
  it('kein scharfes S in den Texten', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const bad: string[] = [];
    // Das ganze Projekt, nicht nur die App-Texte
    const skip = new Set(['node_modules', 'dist', 'dist-single', 'artifact', 'test-results', 'playwright-report', '.git', 'public']);
    const walkAll = (dir: string) => {
      for (const f of readdirSync(dir)) {
        if (skip.has(f)) continue;
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walkAll(p);
        else if (/\.(tsx?|mjs|cjs|js|css|html|json|md|ya?ml|toml)$|^\.(gitignore|gitattributes|env\.example)$/.test(f) && readFileSync(p, 'utf8').includes(SHARP_S)) bad.push(p);
      }
    };
    walkAll('.');
    expect([...new Set(bad)]).toEqual([]);
  });

  it('Glossar: überall dieselben Wörter (kein «Gewinn-Tag», «Rückfall», «Streak»)', async () => {
    const { readFileSync } = await import('node:fs');
    // Ohne den Kopfkommentar, der das Glossar selbst erklärt
    const src = readFileSync('src/i18n/de-CH.ts', 'utf8').split('\n').slice(8).join('\n');
    // Nur sichtbare Texte (in Anführungszeichen), keine Schlüssel wie bestStreak
    const text = (src.match(/'(?:[^'\\\n]|\\.)*'|`[^`]*`/g) ?? []).join('\n');
    for (const word of ['Gewinn-Tag', 'Gewinntag', 'Rückfall', 'Streak', 'am Stück', 'Workout', 'Erfolgstag']) expect(text, word).not.toContain(word);
    // Keine Wirkversprechen
    for (const word of ['heilt', 'garantiert', 'wirkt sofort', 'dämpft']) expect(text.toLowerCase(), word).not.toContain(word);
  });
});
