import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../app/store';
import { Ring, Sheet } from '../../ui/ui';
import { dayKey } from '../../domain/time';
import { dayStart } from '../../domain/stats';
import { startDayOf } from '../../domain/rates';
import { templateByKey } from '../../domain/templates';

import type { Goal } from '../../domain/types';
import { app, words } from '../../i18n/de-CH';
import { Ico, UI } from '../../ui/icons';
import type { LucideIcon } from 'lucide-react';

const t = app;

/** Ausrutscher festhalten: ruhig, ohne Effekte, ohne Schuld. */
export function SlipSheet({ goal, goodDays, onClose, onSaved }: { goal: Goal; goodDays: number; onClose: () => void; onSaved: () => void }) {
  const addEvent = useStore((s) => s.addEvent);
  const [units, setUnits] = useState(1);
  const [trigger, setTrigger] = useState<string | undefined>();
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);
  const first = startDayOf(goal);
  return (
    <Sheet onClose={onClose} label={t.heute.slipLink} quiet>
      <span className="eyebrow">{t.slip.eyebrow}</span>
      <h2 style={{ fontSize: '1.75rem' }}>{t.slip.title}</h2>
      <p>
        {t.slip.text} <strong>{t.slip.keep(goodDays)}</strong>
      </p>
      <div className="card flat" style={{ alignItems: 'center' }}>
        <span className="small muted">{t.slip.howMany(goal.unit)}</span>
        <div className="stepper">
          <button aria-label={t.common.less} onClick={() => setUnits((u) => Math.max(1, u - 1))} style={{ width: 52, height: 52 }}>
            −
          </button>
          <span className="val num" style={{ fontSize: '3rem' }}>
            {units}
          </span>
          <button aria-label={t.common.more} onClick={() => setUnits((u) => Math.min(500, u + 1))} style={{ width: 52, height: 52 }}>
            +
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="slip-day">{t.slip.when}</label>
        <input id="slip-day" type="date" className="input" value={day} min={first} max={today} onChange={(e) => setDay(e.target.value || today)} />
      </div>
      <div className="field">
        <span className="label">{t.slip.trigger}</span>
        <div className="option-list">
          {t.triggers.map((x) => (
            <button key={x} className={`option ${trigger === x ? 'on' : ''}`} aria-pressed={trigger === x} onClick={() => setTrigger(trigger === x ? undefined : x)}>
              {x}
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn primary block"
        onClick={() => {
          // Nachgetragen: Mittag des gewählten Tages, nie vor dem Start und nie in der Zukunft
          const d = day < first ? first : day > today ? today : day;
          const at = d === today ? new Date() : new Date(Math.max(new Date(goal.startAt).getTime(), dayStart(d).getTime() + 12 * 3_600_000));
          addEvent({ goalId: goal.id, at: at.toISOString(), units, trigger, kind: 'slip' });
          onSaved();
          onClose();
        }}
      >
        {t.slip.go}
      </button>
      <button className="btn quiet" onClick={onClose}>
        {t.common.cancel}
      </button>
    </Sheet>
  );
}

/** Einen Tag im Verlauf korrigieren: die Menge an diesem Tag. Ersetzt alle Einträge des Tages. */
export function DaySheet({ goal, day, units, onClose, onSaved }: { goal: Goal; day: string; units: number; onClose: () => void; onSaved: () => void }) {
  const setDayUnits = useStore((s) => s.setDayUnits);
  const [n, setN] = useState(units);
  const step = templateByKey(goal.templateKey).step || 1;
  const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));
  return (
    <Sheet onClose={onClose} label={words.date(day)} quiet>
      <span className="eyebrow">{goal.name}</span>
      <h2 style={{ fontSize: '1.625rem' }}>{t.dayEdit.title(words.date(day))}</h2>
      <div className="card flat" style={{ alignItems: 'center' }}>
        <span className="small muted">{t.dayEdit.howMany(goal.unit)}</span>
        <div className="stepper">
          <button aria-label={t.common.less} onClick={() => setN((u) => Math.max(0, +(u - step).toFixed(1)))} style={{ width: 52, height: 52 }}>
            −
          </button>
          <span className="val num" style={{ fontSize: '3rem' }} aria-live="polite">
            {fmt(n)}
          </span>
          <button aria-label={t.common.more} onClick={() => setN((u) => Math.min(200, +(u + step).toFixed(1)))} style={{ width: 52, height: 52 }}>
            +
          </button>
        </div>
      </div>
      <p className="small muted">{t.dayEdit.hint}</p>
      <button
        className="btn primary block"
        onClick={() => {
          setDayUnits(goal.id, day, n);
          onSaved();
          onClose();
        }}
      >
        {t.dayEdit.save}
      </button>
      <button className="btn quiet" onClick={onClose}>
        {t.common.cancel}
      </button>
    </Sheet>
  );
}

const MOVE_SECONDS: Record<string, number[]> = {
  sitzend: [30, 40, 40, 50],
  stehend: [30, 50, 40, 40],
  draussen: [30, 120, 30],
};

type SosMode = null | 'atmen' | 'bewegen' | 'warum' | 'plaene';

/** Notfall: «Schwierig gerade?» Ruhig gehalten, ohne Effekte. */
export function SosSheet({ goal, onClose, onSlip, onMoved }: { goal: Goal; onClose: () => void; onSlip?: () => void; onMoved: () => void }) {
  const [mode, setMode] = useState<SosMode>(null);
  const plans = useStore((s) => s.plans);
  const back = (
    <button className="btn ghost block" onClick={() => setMode(null)}>
      {t.common.back}
    </button>
  );
  const options: { m: Exclude<SosMode, null>; e: LucideIcon; title: string; hint: string }[] = [
    { m: 'atmen', e: UI.breathe, title: t.sos.breathe, hint: t.sos.breatheHint },
    { m: 'bewegen', e: UI.move, title: t.sos.move, hint: t.sos.moveHint },
    { m: 'warum', e: UI.why, title: t.sos.why, hint: t.sos.whyHint },
    { m: 'plaene', e: UI.plans, title: t.sos.plans, hint: t.sos.plansHint },
  ];
  return (
    <Sheet onClose={onClose} label={t.heute.sos} quiet={mode !== 'atmen' && mode !== 'bewegen'}>
      {!mode && (
        <>
          <span className="eyebrow">{t.sos.eyebrow}</span>
          <h2 style={{ fontSize: '1.75rem' }}>{t.sos.title}</h2>
          <div className="grid2">
            {options.map((o) => (
              <button key={o.m} className="card pick" onClick={() => setMode(o.m)}>
                <Ico i={o.e} size={28} />
                <strong>{o.title}</strong>
                <span className="small muted">{o.hint}</span>
              </button>
            ))}
          </div>
          {/* Fachstelle als echte Links: direkt zu SafeZone.ch oder anrufen */}
          <div className="sos-help">
            <strong>{t.sos.help}</strong>
            <span className="small muted">{t.sos.helpHint}</span>
            <a href="https://www.safezone.ch" target="_blank" rel="noreferrer">
              {t.profil.safezone}
            </a>
            <a href={`tel:${t.profil.stoplinePhone.replace(/\s/g, '')}`}>{t.sos.helpCall(t.profil.stopline, t.profil.stoplinePhone)}</a>
          </div>
          {onSlip && (
            <button className="btn quiet" onClick={onSlip}>
              {t.heute.slipLink}
            </button>
          )}
        </>
      )}
      {mode === 'warum' && (
        <>
          <span className="eyebrow">{t.sos.why}</span>
          {goal.why ? <p className="why-big">«{goal.why}»</p> : <p>{t.sos.noWhy}</p>}
          {back}
        </>
      )}
      {mode === 'plaene' && (
        <>
          <span className="eyebrow">{t.sos.plans}</span>
          {plans.length ? (
            <ul className="plain-list stack-10">
              {plans.map((p) => (
                <li key={p.id} className="plan-item">
                  {t.planIdeas.joined(p.when, p.then)}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t.sos.noPlans}</p>
          )}
          {back}
        </>
      )}
      {mode === 'atmen' && <Breathe onClose={onClose} />}
      {mode === 'bewegen' && (
        <Move
          onClose={onClose}
          onDone={() => {
            onMoved();
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

/** «Wie stark ist das Verlangen jetzt?» Privat, wird einmal gespeichert und zählt für «Verlangen überstanden». */
function CravingRating({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <>
      <h2 style={{ fontSize: '1.5rem' }}>{t.move.craving}</h2>
      <div className="row" style={{ justifyContent: 'space-between' }} role="radiogroup" aria-label={t.move.craving}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={value === n} className={`dchip ${value === n ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row between tiny muted">
        <span>{t.move.cravingLow}</span>
        <span>{t.move.cravingHigh}</span>
      </div>
    </>
  );
}

function Breathe({ onClose }: { onClose: () => void }) {
  const addCraving = useStore((s) => s.addCraving);
  const [rating, setRating] = useState<number | null>(null);
  const [sec, setSec] = useState(0);
  const total = 60;
  useEffect(() => {
    if (sec >= total) return;
    const i = setTimeout(() => setSec((x) => x + 1), 1000);
    return () => clearTimeout(i);
  }, [sec]);
  const inhale = sec % 10 < 4;
  const done = sec >= total;
  return (
    <>
      <span className="eyebrow">{t.breathe.eyebrow}</span>
      <div style={{ display: 'grid', placeItems: 'center', paddingBlock: 8 }}>
        <Ring progress={sec / total} size={240} stroke={10} tone="calm">
          <div className={`breath ${done ? '' : inhale ? 'in' : 'out'}`}>
            <strong>{done ? t.breathe.done : inhale ? t.breathe.inhale : t.breathe.exhale}</strong>
          </div>
        </Ring>
      </div>
      {done ? <CravingRating value={rating} onChange={setRating} /> : <p style={{ textAlign: 'center' }} className="muted">{t.breathe.guide}</p>}
      <button
        className="btn primary block"
        onClick={() => {
          if (done && rating !== null) addCraving(rating);
          onClose();
        }}
      >
        {done ? t.breathe.back : t.breathe.later}
      </button>
    </>
  );
}

/** Kurz bewegen zählt als «Verlangen überstanden», nicht als Training. */
function Move({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const addCraving = useStore((s) => s.addCraving);
  const [kind, setKind] = useState<null | string>(null);
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const saved = useRef(false);
  const seq = useMemo(() => (kind ? t.move.steps[kind].map((text, i) => ({ text, s: MOVE_SECONDS[kind][i] })) : []), [kind]);
  // Einmal speichern: «Verlangen überstanden», die Stärke bleibt privat und ist freiwillig
  const finish = () => {
    if (!saved.current) {
      addCraving(rating ?? undefined);
      saved.current = true;
    }
  };
  const finished = kind !== null && step >= seq.length;
  useEffect(() => {
    if (!kind || finished) return;
    if (left <= 0) {
      setLeft(seq[step].s);
      return;
    }
    const i = setTimeout(() => {
      if (left === 1) {
        setStep((s) => s + 1);
        setLeft(0);
      } else setLeft((l) => l - 1);
    }, 1000);
    return () => clearTimeout(i);
  }, [kind, step, left, finished, seq]);
  const totalS = seq.reduce((a, b) => a + b.s, 0);
  const doneS = seq.slice(0, step).reduce((a, b) => a + b.s, 0) + (step < seq.length ? seq[step].s - left : 0);

  if (!kind)
    return (
      <>
        <span className="eyebrow">{t.sos.move}</span>
        <h2 style={{ fontSize: '1.625rem' }}>{t.move.where}</h2>
        <div className="grid3">
          {(
            [
              ['sitzend', UI.sitting],
              ['stehend', UI.standing],
              ['draussen', UI.outside],
            ] as const
          ).map(([k, e]) => (
            <button key={k} className="option place" onClick={() => setKind(k)}>
              <Ico i={e} size={28} />
              {t.move.places[k]}
            </button>
          ))}
        </div>
        <p className="small muted">{t.sos.moveNote}</p>
        <p className="small safety">{t.move.safety}</p>
      </>
    );
  if (!finished)
    return (
      <>
        <span className="eyebrow">{t.move.step(step + 1, seq.length)}</span>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Ring progress={doneS / totalS} size={230} stroke={12} tone="moss">
            <strong className="num" style={{ fontSize: '3rem' }}>
              {left}
            </strong>
            <span className="small muted">{t.move.seconds}</span>
          </Ring>
        </div>
        <h2 style={{ fontSize: '1.5rem', textAlign: 'center' }}>{seq[Math.min(step, seq.length - 1)].text}</h2>
        <button className="btn ghost block" onClick={onClose}>
          {t.common.cancel}
        </button>
      </>
    );
  return (
    <>
      <span className="eyebrow">{t.move.done}</span>
      <CravingRating value={rating} onChange={setRating} />
      <button
        className="btn moss block"
        onClick={() => {
          finish();
          onDone();
        }}
      >
        {t.move.log}
      </button>
    </>
  );
}
