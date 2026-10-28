import { useEffect, useRef, useState } from 'react';
import { TEMPLATES, type HabitTemplate } from '../../domain/templates';
import { useStore } from '../../app/store';
import { CountUp, Ring } from '../../ui/ui';
import { spark } from '../../ui/motion';
import { chf, num } from '../../domain/format';
import { yearly } from '../../domain/stats';
import { planSteps } from '../../domain/reduction';
import type { Mode } from '../../domain/types';
import { app, words } from '../../i18n/de-CH';

const t = app.onboarding;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

export default function Onboarding({
  onDone,
  onCancel,
  first,
  challenge,
}: {
  onDone: () => void;
  onCancel: () => void;
  first: boolean;
  challenge?: { templateKey: string; days: number } | null;
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
  const [secs, setSecs] = useState(0);
  const tilesRef = useRef<HTMLDivElement>(null);
  const challengeTpl = challenge ? TEMPLATES.find((x) => x.key === challenge.templateKey) : undefined;

  // Challenge-Link: Vorlage ist schon gewählt
  useEffect(() => {
    if (challengeTpl) choose(challengeTpl);
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

  const priceNum = Math.max(0, parseFloat(price.replace(',', '.')) || 0);
  const y = yearly(perDay, priceNum);

  function start() {
    if (!tpl) return;
    addGoal({
      templateKey: tpl.key,
      name: name.trim() || tpl.name,
      emoji: tpl.emoji,
      unit: tpl.unit,
      perDay,
      price: tpl.timeBased ? 0 : priceNum,
      mode,
      startAt: new Date().toISOString(),
      targetPerDay: 0,
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
                <span className="e" aria-hidden="true">
                  {x.emoji}
                </span>
                <span className="n">{x.name}</span>
              </button>
            ))}
          </div>
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
                <button
                  className="btn quiet block"
                  onClick={() => {
                    enterDemo();
                    onDone();
                  }}
                >
                  {t.example}
                </button>
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
              <span aria-hidden="true">{tpl.emoji}</span> {tpl.name}
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
              <button aria-label={app.common.less} onClick={() => setPerDay((v) => Math.max(tpl.step, +(v - tpl.step).toFixed(1)))}>
                −
              </button>
              <span className="val num" aria-live="polite">
                {fmt(perDay)}
              </span>
              <button aria-label={app.common.more} onClick={() => setPerDay((v) => Math.min(500, +(v + tpl.step).toFixed(1)))}>
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
                <input id="ob-price" className="input num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              {tpl.priceHint && <span className="tiny muted">{t.priceHint(tpl.priceHint)}</span>}
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
              <span className="tiny muted">{t.reducePlan(planSteps(perDay, 0, weeks, perDay % 1 ? 0.5 : 1).map(fmt).join(' → '))}</span>
            </div>
          )}
          <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setMode(mode === 'quit' ? 'reduce' : 'quit')}>
            {mode === 'quit' ? t.reduceLink : t.quitLink}
          </button>
          <div className="ob-bar">
            <div className="ob-bar-inner row">
              <button className="btn ghost" onClick={() => setStep(1)}>
                {app.common.back}
              </button>
              <button className="btn primary" style={{ flex: 1 }} disabled={tpl.key === 'eigene' && !name.trim()} onClick={() => setStep(3)}>
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
            <span style={{ fontSize: 44 }} className="float" aria-hidden="true">
              {tpl?.emoji}
            </span>
          </Ring>
          <h1 style={{ fontSize: 30 }}>{t.startedTitle}</h1>
          <p className="num" style={{ fontSize: 22, fontWeight: 700 }}>
            {t.startedSince(words.seconds(secs + 1))}
          </p>
          <p className="muted">{t.startedNote}</p>
        </div>
      )}
    </div>
  );
}
