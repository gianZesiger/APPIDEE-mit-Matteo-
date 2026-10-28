// Teilen-Karte als Bild. Entsteht nur auf dem Gerät, nichts wird hochgeladen.

export type CardFormat = 'story' | 'square';

export interface CardLine {
  text: string;
  tone: 'ink' | 'primary' | 'gold';
}

const SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };
const C = { bg1: '#04262b', bg2: '#071a1d', ink: '#e4f0ee', muted: '#93aeab', primary: '#3cc7be', gold: '#e2c17f', moss: '#9ccb6a' };
const DISPLAY = '"Familjen Grotesk", "Segoe UI", system-ui, sans-serif';
const BODY = '"Instrument Sans", "Segoe UI", system-ui, sans-serif';

/** Schriften laden, damit das Bild nicht mit Ersatzschrift entsteht. */
async function fontsReady() {
  try {
    await Promise.all([document.fonts.load(`700 120px ${DISPLAY}`), document.fonts.load(`600 40px ${BODY}`)]);
  } catch {
    /* Ersatzschrift ist auch in Ordnung */
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function drawCard(format: CardFormat, headline: string, lines: CardLine[], footer: string): Promise<HTMLCanvasElement> {
  await fontsReady();
  const [W, H] = SIZE[format];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  // Hintergrund: Aare-Licht, ruhiger Verlauf mit zwei Lichtflecken
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, col] of [
    [W * 0.85, H * 0.12, W * 0.6, 'rgba(60,199,190,0.22)'],
    [W * 0.1, H * 0.9, W * 0.7, 'rgba(226,193,127,0.14)'],
  ] as const) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = 96;
  // Marke
  ctx.lineWidth = 18;
  ctx.strokeStyle = C.primary;
  ctx.beginPath();
  ctx.arc(pad + 30, pad + 30, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(pad + 30, pad + 30, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Weniger', pad + 84, pad + 32);

  // Inhalt vertikal mittig
  ctx.textBaseline = 'alphabetic';
  const headSize = format === 'story' ? 128 : 104;
  ctx.font = `800 ${headSize}px ${DISPLAY}`;
  const headLines = wrap(ctx, headline, W - pad * 2);
  const lineSize = format === 'story' ? 76 : 64;
  const blockH = headLines.length * headSize * 1.05 + 56 + lines.length * lineSize * 1.35;
  let y = Math.max(pad + 220, (H - blockH) / 2 + headSize);
  for (const l of headLines) {
    ctx.fillStyle = C.ink;
    ctx.fillText(l, pad, y);
    y += headSize * 1.05;
  }
  y += 56 - headSize * 0.05;
  for (const l of lines) {
    ctx.font = `700 ${lineSize}px ${DISPLAY}`;
    ctx.fillStyle = l.tone === 'gold' ? C.gold : l.tone === 'primary' ? C.primary : C.ink;
    for (const part of wrap(ctx, l.text, W - pad * 2)) {
      ctx.fillText(part, pad, y);
      y += lineSize * 1.35;
    }
  }

  ctx.font = `600 36px ${BODY}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(footer, pad, H - pad);
  return c;
}

/** Teilen über das System-Menü, sonst herunterladen. */
export async function shareCanvas(c: HTMLCanvasElement, name: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return 'cancelled';
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
