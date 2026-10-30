import { useMemo } from 'react';
import { qrPath } from '../../ui/qr';
import { publicLink } from '../../config';
import { app } from '../../i18n/de-CH';

const t = app.desktop;

/** Linke Seite auf breiten Bildschirmen: kurz erklären und mit dem QR-Code aufs Handy schicken. */
export default function DesktopAside() {
  // Nur die öffentliche Adresse, nie location.href. Ohne Adresse: «Link folgt».
  const url = publicLink('/app/');
  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);
  const margin = 2;
  const box = (qr?.size ?? 0) + margin * 2;
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
      {qr ? (
        <figure className="desk-qr">
          <svg viewBox={`${-margin} ${-margin} ${box} ${box}`} role="img" aria-label={t.qrAlt} shapeRendering="crispEdges">
            <rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
            <path d={qr.d} fill="#10312f" />
          </svg>
          <figcaption className="small muted">{url.replace(/^https?:\/\//, '')}</figcaption>
        </figure>
      ) : (
        <p className="desk-qr qr-soon">{t.linkSoon}</p>
      )}
    </aside>
  );
}
