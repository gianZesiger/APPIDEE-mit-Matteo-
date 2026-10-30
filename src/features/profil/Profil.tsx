import { useState, useSyncExternalStore } from 'react';
import { exportJson, useStore } from '../../app/store';
import { daysCsv, workoutsCsv } from '../../domain/csv';
import { downloadFile, Sheet } from '../../ui/ui';
import { Restore } from '../shared/Restore';
import { app } from '../../i18n/de-CH';
import { fxAuto, subscribeFx, type FxChoice } from '../../ui/fx-level';

const FX_SHOWN: FxChoice[] = ['auto', 'hoch', 'tief'];

const t = app.profil;
const today = () => new Date().toISOString().slice(0, 10);
// In der Einzeldatei-Vorschau gibt es keine Unterseiten
const LEGAL = !import.meta.env.VITE_SINGLEFILE;

export default function Profil() {
  // Eine alte Wahl «mittel» zählt hier als «Automatisch»
  const stored = useStore((s) => s.fxLevel);
  const fx = stored === 'mittel' ? 'auto' : stored;
  const setFx = useStore((s) => s.setFxLevel);
  const autoLevel = useSyncExternalStore(subscribeFx, fxAuto, () => 'hoch' as const);
  const wipe = useStore((s) => s.wipe);
  const weekly = useStore((s) => s.weeklyReview);
  const setWeekly = useStore((s) => s.setWeeklyReview);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);

  /** Ein Export, mehrere Dateien zur Auswahl: Sicherung (JSON) und Tabellen (CSV). */
  function runExport(pick: { json: boolean; days: boolean; trainings: boolean }) {
    const s = useStore.getState();
    if (pick.json) {
      s.markBackup();
      const json = exportJson();
      downloadFile(`weniger-sicherung-${today()}.json`, json, 'application/json');
      setExported(json);
      const copy = navigator.clipboard?.writeText(json);
      if (copy) copy.then(() => setMsg(t.backupCopied), () => setMsg(t.backupManual));
      else setMsg(t.backupManual);
    }
    if (pick.days) downloadFile(`weniger-tage-${today()}.csv`, daysCsv(s.goals, s.events, s.checkins, new Date()), 'text/csv;charset=utf-8');
    if (pick.trainings) downloadFile(`weniger-trainings-${today()}.csv`, workoutsCsv(s.workouts, (k) => app.sports[k] ?? k), 'text/csv;charset=utf-8');
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="page-title">{t.h1}</h1>
      </div>

      <section className="card help" aria-labelledby="help-h">
        <h2 id="help-h" className="card-title">
          {t.help}
        </h2>
        <p className="small">{t.helpText}</p>
        <div className="list">
          <div className="list-row">
            <div style={{ minWidth: 0 }}>
              <strong>{t.safezone}</strong>
              <p className="tiny muted">{t.safezoneText}</p>
            </div>
            <a className="btn sm ghost" href="https://www.safezone.ch" target="_blank" rel="noreferrer">
              {t.open}
            </a>
          </div>
          <div className="list-row">
            <div style={{ minWidth: 0 }}>
              <strong>{t.stopline}</strong>
              <p className="tiny muted">
                {t.phone} <span className="selectable">{t.stoplinePhone}</span> · {t.stoplineWeb}
              </p>
            </div>
            <a className="btn sm ghost" href={`tel:${t.stoplinePhone.replace(/\s/g, '')}`}>
              {t.phone}
            </a>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="settings-h">
        <h2 id="settings-h" className="card-title">
          {t.settings}
        </h2>
        <fieldset className="fx-field">
          <legend>
            <strong>{t.fx}</strong>
          </legend>
          <div className="seg" role="radiogroup" aria-label={t.fx}>
            {FX_SHOWN.map((c) => (
              <label key={c} className={`seg-opt${fx === c ? ' on' : ''}`}>
                <input type="radio" name="fx" value={c} checked={fx === c} onChange={() => setFx(c)} />
                <span>{t.fxChoices[c]}</span>
              </label>
            ))}
          </div>
          <span className="small muted">{t.fxHint}</span>
          {fx === 'auto' && <span className="small muted">{t.fxAuto(t.fxChoices[autoLevel])}</span>}
        </fieldset>
        <label htmlFor="weekly-review" className="row between toggle-row">
          <span>
            <strong>{t.weeklyReview}</strong>
            <br />
            <span className="small muted">{t.weeklyReviewHint}</span>
          </span>
          <input id="weekly-review" type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
        </label>
        <div>
          <strong>{t.install}</strong>
          <p className="small muted">{t.installHint}</p>
        </div>
      </section>

      <section className="card" aria-labelledby="data-h">
        <h2 id="data-h" className="card-title">
          {t.data}
        </h2>
        <p className="small">{t.dataText}</p>
        <button className="btn ghost" onClick={() => setExportOpen(true)}>
          {t.export}
        </button>
        {exported && <textarea className="input code-area" readOnly value={exported} aria-label={t.backupText} />}
        <Restore withPaste onDone={setMsg} />
        {confirm ? (
          <div className="card flat" role="alertdialog" aria-label={t.wipe}>
            <p className="small">{t.wipeText}</p>
            <div className="row">
              <button className="btn ghost sm" onClick={() => setConfirm(false)}>
                {app.common.cancel}
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  void wipe();
                  setConfirm(false);
                }}
              >
                {t.wipeYes}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn quiet" onClick={() => setConfirm(true)}>
            {t.wipe}
          </button>
        )}
        {msg && (
          <p className="small" role="status">
            {msg}
          </p>
        )}
      </section>

      {exportOpen && (
        <ExportSheet
          onClose={() => setExportOpen(false)}
          onExport={(pick) => {
            runExport(pick);
            setExportOpen(false);
          }}
        />
      )}

      <section className="card flat">
        <h2 className="card-title">{t.about}</h2>
        <p className="small muted">{t.aboutText}</p>
        {LEGAL && (
          <p className="small row" style={{ gap: 16 }}>
            <a href="/datenschutz/">{t.privacy}</a>
            <a href="/impressum/">{t.imprint}</a>
          </p>
        )}
      </section>
    </div>
  );
}

function ExportSheet({ onClose, onExport }: { onClose: () => void; onExport: (pick: { json: boolean; days: boolean; trainings: boolean }) => void }) {
  const [pick, setPick] = useState({ json: true, days: true, trainings: false });
  const none = !pick.json && !pick.days && !pick.trainings;
  const options: { k: keyof typeof pick; label: string }[] = [
    { k: 'json', label: t.exportJson },
    { k: 'days', label: t.csv },
    { k: 'trainings', label: t.csvTrainings },
  ];
  return (
    <Sheet onClose={onClose} label={t.export}>
      <h2 style={{ fontSize: '1.5rem' }}>{t.exportTitle}</h2>
      <fieldset className="stack-10" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">{t.exportTitle}</legend>
        {options.map((o) => (
          <label key={o.k} htmlFor={`ex-${o.k}`} className="row between toggle-row">
            <span>{o.label}</span>
            <input id={`ex-${o.k}`} type="checkbox" checked={pick[o.k]} onChange={(e) => setPick((p) => ({ ...p, [o.k]: e.target.checked }))} />
          </label>
        ))}
      </fieldset>
      {none && (
        <p className="field-error" role="alert">
          {t.exportNone}
        </p>
      )}
      <button className="btn primary block" disabled={none} onClick={() => onExport(pick)}>
        {t.exportGo}
      </button>
    </Sheet>
  );
}
