// Erzeugt die App-Icons passend zu public/icon.svg (Aare-Licht), ohne Abhängigkeiten:
//   icon-192.png, icon-512.png       abgerundet, für «any»
//   icon-maskable-512.png            randlos, Zeichen in der sicheren Zone (80 %), für «maskable»
//   apple-touch-icon.png (180)       randlos und deckend, iOS rundet selbst
// Aufruf: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x0f, 0x7f, 0x7f];
const RING = [0xcf, 0xe8, 0xe6];
const GOLD = [0xe2, 0xc1, 0x7f];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    let c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Gleiche Geometrie wie das SVG (viewBox 512): Radius 150, Strich 44, 70 % Bogen ab oben, Kern 62.
function png(size, { bleed = false, scale = 1 } = {}) {
  const k = (size / 512) * scale;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const corner = 112 * k;
  const arc = 700 / (2 * Math.PI * 150); // Anteil des Kreises
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const px = x + 0.5, py = y + 0.5;
      // abgerundetes Quadrat
      const qx = Math.max(corner - px, 0, px - (size - corner));
      const qy = Math.max(corner - py, 0, py - (size - corner));
      const inside = bleed || qx * qx + qy * qy <= corner * corner;
      const dx = px - size / 2, dy = py - size / 2;
      const d = Math.hypot(dx, dy) / k;
      const angle = ((Math.atan2(dx, -dy) / (2 * Math.PI)) + 1) % 1; // 0 = oben, im Uhrzeigersinn
      const onArc = Math.abs(d - 150) <= 22 && angle <= arc;
      // runde Enden des Bogens
      const capA = Math.hypot(dx / k, dy / k + 150) <= 22;
      const endAng = arc * 2 * Math.PI;
      const capB = Math.hypot(dx / k - 150 * Math.sin(endAng), dy / k + 150 * Math.cos(endAng)) <= 22;
      const col = d <= 62 ? GOLD : onArc || capA || capB ? RING : BG;
      raw[i] = col[0];
      raw[i + 1] = col[1];
      raw[i + 2] = col[2];
      raw[i + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/icon-maskable-512.png', png(512, { bleed: true, scale: 0.8 }));
writeFileSync('public/apple-touch-icon.png', png(180, { bleed: true, scale: 0.9 }));
console.log('Icons erzeugt.');
