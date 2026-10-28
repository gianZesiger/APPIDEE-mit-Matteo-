// Kleines Skript für die Landingpage: Rechner, Installieren-Tabs, QR-Code, optionale Messung.
// Die Seite ist vorgerendert und funktioniert auch ohne dieses Skript.
import { landing, things } from '../i18n/de-CH';
import { presetByKey, yearlyCost } from '../domain/presets';
import { moneyCompare } from '../domain/compare';
import { chf } from '../domain/format';
import { track, initAnalytics } from './analytics';
import { fxLevel, initFx, motionOK, subscribeFx } from '../ui/fx-level';

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

// ---------- Rechner ----------

function setupCalculator() {
  const form = $<HTMLFormElement>('[data-calc]');
  if (!form) return;
  const perDayEl = $<HTMLOutputElement>('[data-perday]', form)!;
  const priceEl = $<HTMLInputElement>('[data-price]', form)!;
  const totalEl = $<HTMLElement>('[data-total]', form)!;
  const compareEl = $<HTMLElement>('[data-compare]', form)!;
  const perDayLabel = $<HTMLElement>('[data-perday-label]', form)!;
  const priceLabel = $<HTMLElement>('[data-price-label]', form)!;
  const yourEl = $<HTMLElement>('[data-your]');
  const checked = () => $<HTMLInputElement>('input[name="habit"]:checked', form)?.value ?? 'mate';
  let key = checked();
  let perDay = parseFloat(perDayEl.value || perDayEl.textContent || '1') || 1;
  let shown = yearlyCost(perDay, parseFloat(priceEl.value) || 0);
  let raf = 0;
  let used = false;

  const price = () => Math.max(0, Math.min(500, parseFloat(priceEl.value.replace(',', '.')) || 0));
  const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

  function countTo(target: number) {
    cancelAnimationFrame(raf);
    if (!motionOK()) {
      shown = target;
      totalEl.textContent = chf(target, 0);
      return;
    }
    const from = shown;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 600);
      shown = from + (target - from) * (1 - Math.pow(1 - k, 3));
      totalEl.textContent = chf(shown, 0);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function update(interacted: boolean) {
    const total = yearlyCost(perDay, price());
    perDayEl.value = fmt(perDay);
    perDayEl.textContent = fmt(perDay);
    countTo(total);
    const cmp = moneyCompare(total);
    compareEl.textContent = cmp ? landing.hero.compare(cmp.count, things[cmp.key]) : '';
    if (interacted && !used) {
      used = true;
      track('Rechner benutzt', { gewohnheit: key });
    }
  }

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name !== 'habit') return;
    key = t.value;
    const p = presetByKey(key);
    const item = landing.calc.find((c) => c.key === key);
    perDay = p.perDay;
    priceEl.value = p.price.toFixed(2);
    if (item) {
      perDayLabel.textContent = item.perDayLabel;
      priceLabel.textContent = item.priceLabel;
      if (yourEl) yourEl.textContent = item.your;
    }
    update(true);
  });
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-step]');
    if (!b) return;
    const step = presetByKey(key).step;
    perDay = Math.max(step, Math.min(200, +(perDay + Number(b.dataset.step) * step).toFixed(1)));
    update(true);
  });
  priceEl.addEventListener('input', () => update(true));
  form.addEventListener('submit', (e) => e.preventDefault());

  // Die Zahl zählt beim ersten Anzeigen einmal hoch
  if (motionOK() && 'IntersectionObserver' in window) {
    const target = shown;
    shown = 0;
    totalEl.textContent = chf(0, 0);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) {
        countTo(target);
        io.disconnect();
      }
    });
    io.observe(totalEl);
  }
}

// ---------- Installieren: Tabs und beforeinstallprompt ----------

type InstallEvent = Event & { prompt: () => Promise<void> };

function setupInstall() {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      select(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });
  // Android zuerst zeigen, wenn es ein Android-Gerät ist
  if (/Android/i.test(navigator.userAgent) && tabs[1]) select(tabs[1]);

  const btn = $<HTMLButtonElement>('[data-install]');
  let deferred: InstallEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    if (btn) btn.hidden = false;
  });
  btn?.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    deferred = null;
    btn.hidden = true;
  });
}

// ---------- QR-Code nur auf grossen Bildschirmen (dort ist das Handy nicht in der Hand) ----------

function setupQr() {
  const box = $<HTMLElement>('[data-qr-box]');
  const svg = $<SVGSVGElement>('[data-qr]');
  if (!box || !svg || !matchMedia('(min-width: 900px)').matches) return;
  void import('../ui/qr').then(({ qrPath }) => {
    const qr = qrPath(`${location.origin}/app/`);
    const m = 2;
    const n = qr.size + m * 2;
    svg.setAttribute('viewBox', `${-m} ${-m} ${n} ${n}`);
    const ns = 'http://www.w3.org/2000/svg';
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', String(-m));
    bg.setAttribute('y', String(-m));
    bg.setAttribute('width', String(n));
    bg.setAttribute('height', String(n));
    bg.setAttribute('fill', '#fff');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', qr.d);
    path.setAttribute('fill', '#10312f');
    svg.append(bg, path);
    box.hidden = false;
  });
}

// ---------- Effekte: Kaustik im Hero, Scroll-Reveal, Tilt, Funken ----------

function setupCaustics() {
  const canvas = $<HTMLCanvasElement>('.hero-caustics');
  if (!canvas) return;
  let stop: (() => void) | null = null;
  let shown = '';
  const sync = () => {
    const level = fxLevel();
    if (level === shown) return;
    shown = level;
    stop?.();
    stop = null;
    if (level === 'tief') return;
    void import('../fx/caustics-gl').then(({ startCaustics }) => {
      if (shown !== level) return;
      // Neue Zeichenfläche, damit ein freigegebener WebGL-Kontext nicht wiederverwendet wird
      const c = canvas.isConnected ? canvas : $<HTMLCanvasElement>('.hero-caustics');
      if (!c) return;
      const fresh = c.cloneNode() as HTMLCanvasElement;
      c.replaceWith(fresh);
      stop = startCaustics(fresh, { animate: level === 'hoch' })?.stop ?? null;
    });
  };
  sync();
  subscribeFx(sync);
}

function setupEffects() {
  if (!motionOK()) return;
  void import('../fx/effects').then((m) => {
    m.installInteractions();
    m.reveal();
  });
}

function setupStart() {
  document.querySelectorAll<HTMLAnchorElement>('[data-start]').forEach((a) =>
    a.addEventListener('click', (e) => {
      track('Starten geklickt');
      // Kurz goldene Funken, dann in die App. Mit Zusatztaste (neuer Tab) oder ohne Bewegung sofort.
      if (!motionOK() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const r = a.getBoundingClientRect();
      void import('../fx/effects').then((m) => m.sparkBurst(r.left + r.width / 2, r.top + r.height / 2, { count: 60 }));
      setTimeout(() => location.assign(a.href), 320);
    }),
  );
}

initFx();
initAnalytics();
setupCalculator();
setupInstall();
setupQr();
setupStart();
setupCaustics();
if ('requestIdleCallback' in window) requestIdleCallback(setupEffects, { timeout: 1500 });
else setTimeout(setupEffects, 300);
