export function chf(n: number, decimals = 2): string {
  const v = Number.isFinite(n) ? n : 0;
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return dec ? `${withSep}.${dec}` : withSep;
}

/** Betrag zum Vorlesen: «80 Franken 44», ohne Rappen «80 Franken». */
export function chfSpeech(n: number): string {
  const v = Math.max(0, Number.isFinite(n) ? n : 0);
  const fr = Math.floor(v + 1e-9);
  const rp = Math.round((v - fr) * 100) % 100;
  return rp ? `${fr} Franken ${rp}` : `${fr} Franken`;
}

export function num(n: number): string {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '’');
}
