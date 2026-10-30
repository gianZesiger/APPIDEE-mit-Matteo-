import { useRef, useState } from 'react';
import { useStore, type ImportPreview } from '../../app/store';
import { app } from '../../i18n/de-CH';

const t = app.profil;

/**
 * Sicherung wiederherstellen: erst eine Vorschau («2 Gewohnheiten, 42 gute Tage – ersetzen?»),
 * ersetzt wird erst nach dem Bestätigen. Eine ungültige Datei ergibt eine klare Meldung.
 */
export function Restore({ onDone, withPaste = false, className = 'btn ghost', label = t.restore }: { onDone?: (message: string) => void; withPaste?: boolean; className?: string; label?: string }) {
  const previewImport = useStore((s) => s.previewImport);
  const applyImport = useStore((s) => s.applyImport);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Extract<ImportPreview, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');

  async function check(text: string) {
    setError(null);
    const r = await previewImport(text);
    if (r.ok) setPreview(r);
    else {
      setPreview(null);
      setError(r.message);
    }
  }

  return (
    <div className="stack-10">
      <button className={className} onClick={() => fileRef.current?.click()}>
        {label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label={t.restore}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) await check(await f.text());
        }}
      />
      {withPaste && (
        <div className="field">
          <label htmlFor="paste-backup">{t.restorePaste}</label>
          <textarea id="paste-backup" className="input code-area" value={paste} onChange={(e) => setPaste(e.target.value)} />
          {paste.trim() && (
            <button className="btn sm ghost" onClick={() => void check(paste)}>
              {t.restorePasteGo}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="card flat" role="alertdialog" aria-labelledby="restore-q">
          <p id="restore-q" className="strong">
            {t.restorePreview(preview.goals, preview.goodDays)}
          </p>
          <p className="small muted">{t.restoreWarn}</p>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setPreview(null)}>
              {app.common.cancel}
            </button>
            <button
              className="btn sm primary"
              onClick={() => {
                const msg = applyImport(preview.data, preview.dropped);
                setPreview(null);
                setPaste('');
                onDone?.(msg);
              }}
            >
              {t.restoreYes}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
