// Aare-Licht: Kaustik wie Licht auf einem Flussgrund, als kleiner WebGL-Shader.
// Für App und Landingpage. Kleine Auflösung (die Unschärfe macht CSS), 15 Bilder pro Sekunde.
// Die Farbe wird einmal gelesen (und nur beim Wechsel hell/dunkel neu).
// Pausiert, wenn die Seite im Hintergrund ist und nach 20 Sekunden ohne Eingabe.
import { isIdle, subscribeFx } from '../ui/fx-level';

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 c;
void main(){
  vec2 q=gl_FragCoord.xy/r.y*7.;
  float a=sin(q.x+t*.6)+sin(q.y*1.3-t*.4)+sin((q.x+q.y)*.7+t*.5)+sin(length(q-vec2(3.,6.))*1.1-t*.8);
  float k=pow(1.-abs(sin(a*1.3)),6.);
  gl_FragColor=vec4(c*k,k);
}`;

const FPS = 15;
/** Pixel der Zeichenfläche pro Pixel auf dem Bildschirm. Klein reicht, CSS weichzeichnet. */
const SCALE = 0.22;

export interface CausticsHandle {
  stop: () => void;
}

function readColor(el: Element): [number, number, number] {
  const v = getComputedStyle(el).getPropertyValue('--caustic').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  const n = m ? parseInt(m[1], 16) : 0x6fe3da;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

/**
 * Startet das Lichtspiel auf der Zeichenfläche. `animate: false` zeichnet ein einziges ruhiges Bild.
 * Gibt null zurück, wenn WebGL fehlt; dann zeigt CSS ein stehendes Bild (.caustics-css).
 */
export function startCaustics(canvas: HTMLCanvasElement, opts: { animate: boolean }): CausticsHandle | null {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');
  const uC = gl.getUniformLocation(prog, 'c');

  let t = Math.random() * 100;
  let raf = 0;
  let last = 0;
  let stopped = false;

  const setColor = () => gl.uniform3fv(uC, readColor(canvas));
  const size = () => {
    const w = Math.max(32, Math.round(canvas.clientWidth * SCALE));
    const h = Math.max(32, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uR, w, h);
  };
  const draw = () => {
    gl.uniform1f(uT, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const running = () => opts.animate && !stopped && !document.hidden && !isIdle();
  // Nur so oft aufwachen, wie gezeichnet wird (nicht bei jedem Bild des Bildschirms)
  let timer = 0;
  const loop = (now: number) => {
    raf = 0;
    if (!running()) return;
    // Gleichmässig weiter, auch wenn ein Bild ausfällt
    t += Math.min(now - last, 200) * 0.00036;
    last = now;
    draw();
    timer = window.setTimeout(() => {
      timer = 0;
      if (running()) raf = requestAnimationFrame(loop);
    }, 1000 / FPS);
  };
  const resume = () => {
    if (!raf && !timer && running()) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  setColor();
  size();
  draw();
  resume();

  const dark = matchMedia('(prefers-color-scheme: dark)');
  const recolor = () => (setColor(), draw());
  const theme = new MutationObserver(recolor);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  dark.addEventListener('change', recolor);
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (size(), draw()));
  ro?.observe(canvas);
  document.addEventListener('visibilitychange', resume);
  const unsub = subscribeFx(resume);
  const lost = (e: Event) => {
    e.preventDefault();
    stop();
  };
  canvas.addEventListener('webglcontextlost', lost);

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = timer = 0;
    theme.disconnect();
    dark.removeEventListener('change', recolor);
    ro?.disconnect();
    document.removeEventListener('visibilitychange', resume);
    canvas.removeEventListener('webglcontextlost', lost);
    unsub();
    // Den Kontext nicht absichtlich verlieren: React startet Effekte im Entwicklungsmodus zweimal auf derselben Fläche
  };
  return { stop };
}
