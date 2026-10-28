import { useEffect, useRef, useState } from 'react';
import { useFxLevel } from '../ui/motion';
import { startCaustics } from './caustics-gl';

/** Hintergrund der App: Kaustik (bewegt auf Stufe hoch, still auf mittel, aus auf tief) und feines Korn. */
export default function Caustics() {
  const ref = useRef<HTMLCanvasElement>(null);
  const level = useFxLevel();
  const [noGl, setNoGl] = useState(false);
  useEffect(() => {
    const c = ref.current;
    if (!c || level === 'tief') return;
    const h = startCaustics(c, { animate: level === 'hoch' });
    if (!h) setNoGl(true);
    return () => h?.stop();
  }, [level]);
  return (
    <div className={`bg-layer${noGl ? ' caustics-css' : ''}`} aria-hidden="true">
      {/* Neue Zeichenfläche pro Stufe: ein verlorener WebGL-Kontext lässt sich nicht weiterverwenden */}
      {level !== 'tief' && !noGl && <canvas key={level} ref={ref} className="caustics" />}
      <svg className="grain" width="100%" height="100%">
        <filter id="grain-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-f)" />
      </svg>
    </div>
  );
}
