import { useMemo } from 'react';
import { qrPath } from '../../ui/qr';
import { app } from '../../i18n/de-CH';

const t = app.desktop;

/** Linke Seite auf breiten Bildschirmen: kurz erklären und mit dem QR-Code aufs Handy schicken. */
export default function DesktopAside() {
  const url = `${location.origin}${location.pathname}`;
  const qr = useMemo(() => qrPath(url), [url]);
  const margin = 2;
  const box = qr.size + margin * 2;
  return (
    <aside className="desk-aside" aria-label={t.title}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        {app.name}
      </div>
      <p className="desk-title">{t.title}</p>
      <p className="desk-text">{t.text}</p>
      <ul className="desk-points">
        {t.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <figure className="desk-qr">
        <svg viewBox={`${-margin} ${-margin} ${box} ${box}`} role="img" aria-label={t.qrAlt} shapeRendering="crispEdges">
          <rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
          <path d={qr.d} fill="#10312f" />
        </svg>
        <figcaption className="small muted">{url.replace(/^https?:\/\//, '')}</figcaption>
      </figure>
    </aside>
  );
}
