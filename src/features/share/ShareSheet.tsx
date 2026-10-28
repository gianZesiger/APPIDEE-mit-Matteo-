import { useEffect, useState } from 'react';
import { Sheet } from '../../ui/ui';
import { app } from '../../i18n/de-CH';
import { drawCard, shareCanvas, type CardFormat, type CardLine } from './card';

const t = app.share;

/** Eine Zeile, die man ein- und ausschalten kann. Standard kommt vom Aufrufer (Gewohnheit und Betrag aus). */
export interface ShareOption extends CardLine {
  id: string;
  label: string;
  on: boolean;
}

/**
 * Vorschau und Teilen. Es wird nur geteilt, was im Bild steht.
 * Ausrutscher, Notizen und Auslöser werden hier nie übergeben.
 */
export default function ShareSheet({ headline, options, onClose, onDone }: { headline: string; options: ShareOption[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [format, setFormat] = useState<CardFormat>('story');
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(options.map((o) => [o.id, o.on])));
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lines = options.filter((o) => on[o.id]);
  const key = `${format}|${lines.map((l) => l.id).join(',')}`;

  useEffect(() => {
    let alive = true;
    void drawCard(format, headline, lines, t.footer).then((c) => {
      if (!alive) return;
      setCanvas(c);
      try {
        setPreview(c.toDataURL('image/png'));
      } catch {
        setPreview(null);
      }
    });
    return () => {
      alive = false;
    };
    // key fasst Format und gewählte Zeilen zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, headline]);

  const alt = [headline, ...lines.map((l) => l.text)].join('. ');
  // Ohne Web Share wird das Bild heruntergeladen: dann heisst der Knopf auch so
  const nav = navigator as Navigator & { canShare?: unknown };
  const canShare = typeof nav.share === 'function' && typeof nav.canShare === 'function';
  return (
    <Sheet onClose={onClose} label={t.title}>
      <h2 style={{ fontSize: 24 }}>{t.title}</h2>
      <div className={`share-preview ${format}`}>{preview ? <img src={preview} alt={alt} /> : <div className="share-ph" aria-hidden="true" />}</div>
      <p className="small strong">{t.preview}</p>
      <div className="chiprow" role="radiogroup" aria-label={t.format}>
        {(['story', 'square'] as const).map((f) => (
          <button key={f} role="radio" aria-checked={format === f} className={`dchip ${format === f ? 'on' : ''}`} onClick={() => setFormat(f)}>
            {f === 'story' ? t.story : t.square}
          </button>
        ))}
      </div>
      <div className="stack-2">
        {options.map((o) => (
          <label key={o.id} className="row between toggle-row" htmlFor={`share-${o.id}`}>
            <span>{o.label}</span>
            <input id={`share-${o.id}`} type="checkbox" checked={!!on[o.id]} onChange={(e) => setOn((s) => ({ ...s, [o.id]: e.target.checked }))} />
          </label>
        ))}
      </div>
      <button
        className="btn primary block"
        disabled={!canvas || busy}
        onClick={async () => {
          if (!canvas) return;
          setBusy(true);
          const r = await shareCanvas(canvas, `weniger-${format}.png`, headline);
          setBusy(false);
          if (r !== 'cancelled') {
            onDone(t.done);
            onClose();
          }
        }}
      >
        {canShare ? t.go : t.download}
      </button>
    </Sheet>
  );
}
