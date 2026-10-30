import { useEffect, useRef, useState } from 'react';
import { TEMPLATES, type HabitTemplate } from '../../domain/templates';
import { useStore } from '../../app/store';
import { CountUp, Ring } from '../../ui/ui';
import { spark } from '../../ui/motion';
import { chf, num } from '../../domain/format';
import { yearly } from '../../domain/stats';
import { yearlyCost } from '../../domain/presets';
import { planSteps } from '../../domain/reduction';
import type { Mode } from '../../domain/types';
import { dayKey } from '../../domain/time';
import { checkGoalInput, PER_DAY_MAX, PER_DAY_MIN } from '../../domain/validate';
import { Field } from '../../ui/Field';
import { Restore } from '../shared/Restore';
import { app, words } from '../../i18n/de-CH';
import { HabitIcon } from '../../ui/icons';

const t = app.onboarding;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

export default function Onboarding({
  onDone,
  onCancel,
  first,
  challenge,
  preset,
}: {
  onDone: () => void;
  onCancel: () => void;
  first: boolean;
  challenge?: { templateKey: string; days: number } | null;
  /** Werte aus dem Rechner der Startseite */
  preset?: { templateKey: string; perDay?: number; price?: number } | null;
}) {
  const addGoal = useStore((s) => s.addGoal);
  const confirmAdult = useStore((s) => s.confirmAdult);
  const enterDemo = useStore((s) => s.enterDemo);
  const [step, setStep] = useState(1);
  const [tpl, setTpl] = useState<HabitTemplate | null>(null);
  const [needPick, setNeedPick] = useState(false);
  const [name, setName] = useState('');
  const [perDay, setPerDay] = useState(0);
  const [price, setPrice] = useState('0');
  const [mode, setMode] = useState<Mode>('quit');
  const [weeks, setWeeks] = useState(4);
  const [why, setWhy] = useState('');
  const today = dayKey(new Date());
  const [startDay, setStartDay] = useState(today);
  const [target, setTarget] = useState('0');
  const [tried, setTried] = useState(false);
  const [secs, setSecs] = useState(0);
  const tilesRef = useRef<HTMLDivElement>(null);
  const challengeTpl = challenge ? TEMPLATES.find((x) => x.key === challenge.templateKey) : undefined;
  const presetTpl = preset ? TEMPLATES.find((x) => x.key === preset.templateKey) : undefined;

  // Challenge-Link: Vorlage ist schon gewählt
  useEffect(() => {
    if (challengeTpl) choose(challengeTpl);
    else if (presetTpl && preset) {
      // Vom Rechner: Gewohnheit gewählt, Menge und Preis übernommen (in den erlaubten Grenzen)
      choose(presetTpl);
      if (preset.perDay !== undefined) setPerDay(Math.min(PER_DAY_MAX, Math.max(PER_DAY_MIN, preset.perDay)));
      if (preset.price !== undefined && preset.price <= 100) setPrice(preset.price.toFixed(2));
    }
    // nur beim ersten Anzeigen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(x: HabitTemplate) {
    setTpl(x);
    setNeedPick(false);
    setName(x.key === 'eigene' ? '' : x.name);
    setPerDay(x.perDay);
    setPrice(x.price ? x.price.toFixed(2) : '0');
  }

  // «Los geht's» ist immer aktiv. Ohne Auswahl zeigt es, was zu tun ist.
  function letsGo() {
    if (!tpl) {
      setNeedPick(true);
      tilesRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    if (first) confirmAdult();
    setStep(2);
  }

  const check = checkGoalInput({ perDay: String(perDay), price, startDay, target: mode === 'reduce' ? target : undefined }, today, { needsPrice: !tpl?.timeBased });
  const priceNum = check.values.price;
  const y = yearly(perDay, priceNum);
  const err = (k: keyof typeof check.errors) => (tried || k === 'startDay' ? check.errors[k] : undefined);

  // Fehler stehen am Feld, weiter geht es erst, wenn alles stimmt
  function next() {
    setTried(true);
    if (!check.ok) {
      const first = (['perDay', 'price', 'target', 'startDay'] as const).find((k) => check.errors[k]);
      if (first) document.getElementById(`ob-${first}`)?.focus();
      return;
    }
    setStep(3);
  }

  function start() {
    if (!tpl) return;
    addGoal({
      templateKey: tpl.key,
      name: name.trim() || tpl.name,
      emoji: tpl.emoji,
      unit: tpl.unit,
      unitOne: tpl.unitOne,
      rates: [{ validFrom: startDay, perDay, price: tpl.timeBased ? 0 : priceNum }],
      mode,
      // Heute: ab jetzt. Ein Tag in der Vergangenheit: ab Mitternacht dieses Tages.
      startAt: startDay === today ? new Date().toISOString() : (() => {
        const [yy, mm, dd] = startDay.split('-').map(Number);
        return new Date(yy, mm - 1, dd).toISOString();
      })(),
      targetPerDay: mode === 'reduce' ? check.values.target : 0,
      planWeeks: weeks,
      why: why.trim() || undefined,
      challengeDays: challenge?.days,
    });
    setStep(4);
  }

  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  // Funken nur beim Start, nicht schon bei der Jahresrechnung
  useEffect(() => {
    if (step !== 4) return;
    spark(undefined, innerHeight * 0.4, { count: 110 });
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    const d = setTimeout(() => doneRef.current(), 2600);
    return () => {
      clearInterval(i);
      clearTimeout(d);
    };
  }, [step]);

  return (
    <div className={`screen ob ${step < 4 ? 'with-bar' : ''}`}>
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {app.name}
        </div>
        {step < 4 && (
          <div className="progress-dots" role="img" aria-label={app.move.step(step, 3)}>
            {[1, 2, 3].map((i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>

      {step === 1 && (
        <>
          <h1 className="hero-title">
            {challengeTpl ? (
              t.challengeTitle(challengeTpl.name, challenge!.days)
            ) : first ? (
              // Das Wort «weniger» im Titel leuchtet im Verlauf
              t.title.split(/(weniger)/).map((part, i) => (part === 'weniger' ? <span key={i} className="grad-text">{part}</span> : part))
            ) : (
              t.titleMore
            )}
          </h1>
          <div className="tiles" ref={tilesRef}>
            {TEMPLATES.map((x) => (
              <button key={x.key} className={`tile tilt ${tpl?.key === x.key ? 'on' : ''} ${x.key === 'eigene' ? 'wide' : ''}`} aria-pressed={tpl?.key === x.key} onClick={() => choose(x)}>
                <HabitIcon k={x.key} size={26} className="e" />
                <span className="n">{x.name}</span>
              </button>
            ))}
          </div>
          {tpl && (
            <p className="tile-year num" aria-live="polite">
              {tpl.timeBased ? t.tileHours(tpl.name, num(perDay * 365)) : t.tileYear(tpl.name, chf(yearlyCost(perDay, priceNum), 0))}
            </p>
          )}
          {needPick && (
            <p className="small hint" role="alert">
              {t.pickFirst}
            </p>
          )}
          <div className="ob-bar">
            <div className="ob-bar-inner">
              {first && <p className="tiny muted ob-note">{t.adultNote}</p>}
              <button className="btn primary block" onClick={letsGo}>
                {first ? t.start : app.common.next}
              </button>
              {first ? (
                // Zwei leise Wege nebeneinander: erst das Beispiel ansehen oder eine Sicherung laden
                <div className="ob-alt">
                  <button
                    className="btn quiet"
                    onClick={() => {
                      enterDemo();
                      onDone();
                    }}
                  >
                    {t.example}
                  </button>
                  <Restore className="btn quiet" label={t.restore} onDone={() => onDone()} />
                </div>
              ) : (
                <button className="btn quiet block" onClick={onCancel}>
                  {app.common.cancel}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {step === 2 && tpl && (
        <>
          <div className="stack-8">
            <span className="eyebrow">
              <HabitIcon k={tpl.key} size={16} /> {tpl.name}
            </span>
            <h1 className="step-title">{tpl.question}</h1>
          </div>
          {tpl.key === 'eigene' && (
            <div className="field">
              <label htmlFor="ob-name">{t.nameLabel}</label>
              <input id="ob-name" className="input" maxLength={60} placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="card" style={{ alignItems: 'center', paddingBlock: 22 }}>
            <div className="stepper">
              <button aria-label={app.common.less} onClick={() => setPerDay((v) => Math.max(PER_DAY_MIN, +(v - tpl.step).toFixed(1)))}>
                −
              </button>
              <span className="val num" aria-live="polite">
                {fmt(perDay)}
              </span>
              <button aria-label={app.common.more} onClick={() => setPerDay((v) => Math.min(PER_DAY_MAX, +(v + tpl.step).toFixed(1)))}>
                +
              </button>
            </div>
            <span className="muted small">{t.perDay(tpl.unit)}</span>
          </div>
          {!tpl.timeBased && (
            <div className="field">
              <label htmlFor="ob-price">{t.priceLabel}</label>
              <div className="money-input">
                <span>{app.common.chf}</span>
                <input
                  id="ob-price"
                  className="input num"
                  inputMode="decimal"
                  value={price}
                  aria-invalid={!!err('price')}
                  aria-describedby="ob-price-msg"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <span id="ob-price-msg" className={err('price') ? 'field-error' : 'tiny muted'} role={err('price') ? 'alert' : undefined}>
                {err('price') ?? (tpl.priceHint ? t.priceHint(tpl.priceHint) : '')}
              </span>
            </div>
          )}
          {mode === 'reduce' && (
            <div className="field">
              <label htmlFor="ob-weeks">{t.reduceWeeks}</label>
              <div className="row">
                <input id="ob-weeks" type="range" min={2} max={12} value={weeks} onChange={(e) => setWeeks(+e.target.value)} style={{ flex: 1 }} />
                <span className="num" style={{ fontWeight: 800, minWidth: 92 }}>
                  {words.weeks(weeks)}
                </span>
              </div>
              <span className="tiny muted">{t.reducePlan(planSteps(perDay, check.values.target, weeks, perDay % 1 ? 0.5 : 1).map(fmt).join(' → '))}</span>
            </div>
          )}
          {mode === 'reduce' && <Field id="ob-target" label={t.target} hint={t.targetHint} value={target} onChange={setTarget} error={err('target')} />}
          <div className="field">
            <label htmlFor="ob-startDay">{t.startLabel}</label>
            <input
              id="ob-startDay"
              type="date"
              className="input"
              value={startDay}
              max={today}
              aria-invalid={!!check.errors.startDay}
              aria-describedby="ob-startDay-msg"
              onChange={(e) => setStartDay(e.target.value)}
            />
            <span id="ob-startDay-msg" className={check.errors.startDay ? 'field-error' : 'tiny muted'} role={check.errors.startDay || check.warnings.startDay ? 'alert' : undefined}>
              {check.errors.startDay ?? check.warnings.startDay ?? t.startHint}
            </span>
          </div>
          <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setMode(mode === 'quit' ? 'reduce' : 'quit')}>
            {mode === 'quit' ? t.reduceLink : t.quitLink}
          </button>
          <div className="ob-bar">
            <div className="ob-bar-inner row">
              <button className="btn ghost" onClick={() => setStep(1)}>
                {app.common.back}
              </button>
              <button className="btn primary" style={{ flex: 1 }} disabled={tpl.key === 'eigene' && !name.trim()} onClick={next}>
                {app.common.next}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && tpl && (
        <>
          <div className="stack-8">
            <span className="eyebrow">{t.ahaEyebrow}</span>
            <h1 className="step-title">{t.ahaTitle}</h1>
          </div>
          <div className="card tilt" style={{ alignItems: 'flex-start', paddingBlock: 26, gap: 16 }}>
            {tpl.timeBased ? (
              <div>
                <div className="hero-money num">
                  <CountUp value={y.units} format={(n) => num(n)} duration={1400} />
                  <span className="cur" style={{ verticalAlign: 'baseline', marginLeft: 6 }}>
                    {app.templates.social.unit}
                  </span>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  {t.ahaHours(Math.round(y.units / 24))}
                </p>
              </div>
            ) : (
              <div>
                <div className="hero-money num">
                  <span className="cur">{app.common.chf}</span>
                  <CountUp value={y.chf} format={(n) => chf(n, 0)} duration={1400} />
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  {t.ahaUnits(num(y.units), tpl.unit)}
                </p>
              </div>
            )}
            <p className="small muted">{t.ahaBasis(fmt(perDay), tpl.unit, !tpl.timeBased && priceNum > 0 ? chf(priceNum) : null)}</p>
          </div>
          <div className="field">
            <label htmlFor="ob-why">{t.whyLabel}</label>
            <input id="ob-why" className="input" maxLength={200} placeholder={t.whyPlaceholder} value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
          <div className="ob-bar">
            <div className="ob-bar-inner row">
              <button className="btn ghost" onClick={() => setStep(2)}>
                {app.common.back}
              </button>
              <button className="btn primary" style={{ flex: 1 }} onClick={start}>
                {t.go}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="started">
          <Ring progress={1} size={220}>
            <span className="float">{tpl && <HabitIcon k={tpl.key} size={40} className="big" />}</span>
          </Ring>
          <h1 style={{ fontSize: '1.875rem' }}>{t.startedTitle}</h1>
          <p className="num" style={{ fontSize: '1.375rem', fontWeight: 700 }}>
            {t.startedSince(words.seconds(secs + 1))}
          </p>
          <p className="muted">{t.startedNote}</p>
        </div>
      )}
    </div>
  );
}
