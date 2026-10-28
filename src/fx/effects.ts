// Effekte, die erst nach dem Start nachgeladen werden (siehe ui/motion.ts: loadFx).
// Animiert werden nur transform und opacity.
import { motionOK, richFx } from '../ui/fx-level';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#3cc7be';
}

/** Goldene Lichtfunken bei Meilensteinen. Liegt nur während der Animation im DOM. */
export function sparkBurst(x?: number, y?: number, opts: { count?: number; colors?: string[] } = {}) {
  if (!motionOK()) return;
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.className = 'spark-canvas';
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  if (!ctx) {
    c.remove();
    return;
  }
  ctx.scale(dpr, dpr);
  const cx = x ?? innerWidth / 2;
  const cy = y ?? innerHeight * 0.35;
  const colors = opts.colors ?? [cssVar('--gold'), cssVar('--primary'), cssVar('--moss'), '#ffffff'];
  // Auf der mittleren Stufe nur halb so viele Funken
  const count = Math.round((opts.count ?? 70) * (richFx() ? 1 : 0.5));
  const ps = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * 6;
    return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, r: 1.5 + Math.random() * 3, c: colors[Math.floor(Math.random() * colors.length)], tw: Math.random() * 6 };
  });
  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += 0.12;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.011;
      p.tw += 0.3;
      ctx.globalAlpha = Math.max(0, p.life) * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (alive && !document.hidden) raf = requestAnimationFrame(tick);
    else {
      cancelAnimationFrame(raf);
      c.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}

let installed = false;

/** Globale Mikro-Interaktionen: Ripple auf Knöpfen, Tilt mit Lichtfleck auf Karten (nur Maus, nur Stufe hoch). Einmal pro Seite. */
export function installInteractions() {
  if (installed) return;
  installed = true;
  const onDown = (e: PointerEvent) => {
    if (!motionOK()) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.btn, .tile, .chip, .option, .sport-pick, .dchip, .lp-btn');
    // Ausrutscher- und Hilfe-Screens bleiben ohne Effekte
    if (!el || (el as HTMLButtonElement).disabled || el.closest('.sheet.quiet')) return;
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'ripple';
    const size = Math.max(r.width, r.height);
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${e.clientX - r.left - size / 2}px`;
    s.style.top = `${e.clientY - r.top - size / 2}px`;
    el.appendChild(s);
    const anim = s.animate?.([{ transform: 'scale(0)', opacity: 0.35 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (anim) anim.finished.then(() => s.remove(), () => s.remove());
    else setTimeout(() => s.remove(), 600);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* nicht verfügbar */
    }
  };
  let frame = 0;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onMove = (e: PointerEvent) => {
    if (!fine || !richFx()) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tilt');
    if (!el || el.closest('.sheet.quiet')) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${-dy * 5}deg) rotateY(${dx * 6}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${(dx + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(dy + 0.5) * 100}%`);
    });
  };
  const onLeave = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest?.<HTMLElement>('.tilt');
    if (el && !el.contains(e.relatedTarget as Node)) el.style.transform = '';
  };
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerout', onLeave);
}

let revealObserver: IntersectionObserver | null = null;

/** Scroll-Reveal: Elemente sind immer sichtbar; nur was später ins Bild kommt, gleitet kurz herein. */
export function reveal() {
  revealObserver?.disconnect();
  if (!motionOK() || typeof IntersectionObserver === 'undefined') return;
  const vh = innerHeight;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        // Startet sichtbar (nie opacity 0), nur ein kurzes Hereingleiten
        en.target.animate?.([{ opacity: 0.4, transform: 'translateY(18px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
        io.unobserve(en.target);
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    if (el.getBoundingClientRect().top > vh) io.observe(el);
  });
  revealObserver = io;
}

/** Einstieg beim Tab-Wechsel: Karten erscheinen gestaffelt. */
export function stagger() {
  if (!motionOK()) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>('.screen > *'));
  els.slice(0, 8).forEach((el, i) => {
    if (el.getBoundingClientRect().top > innerHeight) return;
    el.animate?.([{ opacity: 0.4, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 50, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
}
