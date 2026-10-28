import { useMotionOK } from './motion';

const DIGITS = '0123456789'.split('');

/** Zählwerk: jede Ziffer rollt einzeln. Screenreader bekommen nur srText, die Ziffern sind aria-hidden. */
export function Odometer({ value, className, srText }: { value: string; className?: string; srText?: string }) {
  const ok = useMotionOK();
  return (
    <span className={`odo ${className ?? ''}`}>
      {srText !== '' && <span className="sr-only">{srText ?? value}</span>}
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="odo-col" key={`${i}-${value.length}`} aria-hidden="true">
            <span className="odo-strip" style={{ transform: `translateY(${-Number(ch)}em)`, transition: ok ? undefined : 'none' }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`${i}-${ch}`} aria-hidden="true" className="odo-sep">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
