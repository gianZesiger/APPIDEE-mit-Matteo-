import { useEffect, useRef, useState } from 'react';
import { motionOK } from './motion';

/** Zählt ganze Zahlen weich hoch, wenn sich der Wert ändert. */
export function CountUpInline({ value, duration = 600 }: { value: number; duration?: number }) {
  const [v, setV] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (!motionOK()) {
      setV(value);
      from.current = value;
      return;
    }
    const a = from.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setV(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{v}</>;
}
