import { useRef, useState, useSyncExternalStore } from 'react';
import { exportJson, useStore } from '../../app/store';
import { daysCsv, workoutsCsv } from '../../domain/csv';
import { downloadFile } from '../../ui/ui';
import { app } from '../../i18n/de-CH';
import { FX_CHOICES, fxAuto, subscribeFx } from '../../ui/fx-level';

const t = app.profil;
const today = () => new Date().toISOString().slice(0, 10);
// In der Einzeldatei-Vorschau gibt es keine Unterseiten
const LEGAL = !import.meta.env.VITE_SINGLEFILE;

export default function Profil() {
  const importData = useStore((s) => s.importData);
  const fx = useStore((s) => s.fxLevel);
  const setFx = useStore((s) => s.setFxLevel);
  const autoLevel = useSyncExternalStore(subscribeFx, fxAuto, () => 'hoch' as const);
  const wipe = useStore((s) => s.wipe);
  const weekly = useStore((s) => s.weeklyReview);
  const setWeekly = useStore((s) => s.setWeeklyReview);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  function backup() {
    const json = exportJson();
    downloadFile(`weniger-sicherung-${today()}.json`, json, 'application/json');
    setExported(json);
    const copy = navigator.clipboard?.writeText(json);
    if (copy) copy.then(() => setMsg(t.backupCopied), () => setMsg(t.backupManual));
    else setMsg(t.backupManual);
  }

  function csv(kind: 'tage' | 'trainings') {
    const s = useStore.getState();
    const content = kind === 'tage' ? daysCsv(s.goals, s.events, s.checkins, new Date()) : workoutsCsv(s.workouts, (k) => app.sports[k] ?? k);
    downloadFile(`weniger-${kind}-${today()}.csv`, content, 'text/csv;charset=utf-8');
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
            {FX_CHOICES.map((c) => (
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
        <button className="btn ghost" onClick={backup}>
          {t.backup}
        </button>
        {exported && <textarea className="input code-area" readOnly value={exported} aria-label={t.backupText} />}
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          {t.restore}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setMsg((await importData(await f.text())).message);
            e.target.value = '';
          }}
        />
        <div className="field">
          <label htmlFor="paste-backup">{t.restorePaste}</label>
          <textarea id="paste-backup" className="input code-area" value={paste} onChange={(e) => setPaste(e.target.value)} />
          {paste.trim() && (
            <button
              className="btn sm ghost"
              onClick={async () => {
                const r = await importData(paste);
                setMsg(r.message);
                if (r.ok) setPaste('');
              }}
            >
              {t.restorePasteGo}
            </button>
          )}
        </div>
        <div className="grid2">
          <button className="btn sm ghost" onClick={() => csv('tage')}>
            {t.csv}
          </button>
          <button className="btn sm ghost" onClick={() => csv('trainings')}>
            {t.csvTrainings}
          </button>
        </div>
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
