import { useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { goalSummary, totalSaved } from '../../domain/stats';
import { planStages } from '../../domain/reduction';
import { allocatePots } from '../../domain/savings';
import { moneyCompare } from '../../domain/compare';
import { chf, chfSpeech, num } from '../../domain/format';
import { dayKey } from '../../domain/time';
import { templateByKey } from '../../domain/templates';
import { changeRate, hasMoney, rateOn, startDayOf } from '../../domain/rates';
import { checkGoalInput } from '../../domain/validate';
import type { Goal } from '../../domain/types';
import { Ring, Sheet, useNow } from '../../ui/ui';
import { Odometer } from '../../ui/Odometer';
import { Field } from '../../ui/Field';
import { HabitIcon } from '../../ui/icons';
import { ChevronRight, Pencil } from 'lucide-react';
import { app, words } from '../../i18n/de-CH';
import { Badges, Challenge, Patterns, Plans } from './extras';

const t = app.ziele;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));
const parseNum = (v: string) => Math.max(0, parseFloat(v.replace(',', '.')) || 0);

export default function Ziele({ goNew, goToday }: { goNew: () => void; goToday: () => void }) {
  const goals = useStore((s) => s.goals);
  const events = useStore((s) => s.events);
  const tick = useNow(15_000);
  const now = useMemo(() => new Date(Math.max(tick.getTime(), Date.now())), [tick, events, goals]);
  const all = useMemo(() => goals.map((g) => ({ g, s: goalSummary(g, events, now) })), [goals, events, now]);
  const total = useMemo(() => totalSaved(goals, events, now), [goals, events, now]);
  const cmp = moneyCompare(total);

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="page-title">{t.h1}</h1>
        <button className="btn sm outline" onClick={goNew}>
          {t.add}
        </button>
      </div>

      <section className="card total-card" style={{ gap: 6 }}>
        <span className="eyebrow">{t.total}</span>
        <div className="hero-money num">
          <span className="cur" aria-hidden="true">
            {app.common.chf}
          </span>
          <Odometer value={chf(total)} srText={chfSpeech(total)} />
        </div>
        {cmp && <p className="small muted">{t.compare(cmp.count, app.things[cmp.key])}</p>}
      </section>

      <h2 className="section-title">{t.habits}</h2>
      <ul className="plain-list habit-list">
        {all.map(({ g, s }) => (
          <HabitRow key={g.id} goal={g} saved={s.saved} avoided={s.avoided} goToday={goToday} />
        ))}
      </ul>

      <Pots total={total} />
      <Plans />
      <Patterns />
      <Badges goals={all.map((x) => ({ best: x.s.bestStreak, hasMoney: hasMoney(x.g) }))} saved={total} />
      <Challenge goals={goals} />
    </div>
  );
}

/** Eine Zeile pro Gewohnheit: antippen öffnet sie auf «Heute», der Stift öffnet «Bearbeiten». */
function HabitRow({ goal, saved, avoided, goToday }: { goal: Goal; saved: number; avoided: number; goToday: () => void }) {
  const setActive = useStore((s) => s.setActive);
  const [edit, setEdit] = useState(false);
  const money = hasMoney(goal);
  return (
    <li className="card habit-row tilt reveal" style={{ viewTransitionName: `habit-${goal.id}` }}>
      <button
        className="habit-open"
        onClick={() => {
          setActive(goal.id);
          goToday();
        }}
      >
        <HabitIcon k={goal.templateKey} />
        <span className="habit-text">
          <strong className="habit-name">{goal.name}</strong>
          <span className="small muted">{goal.mode === 'quit' ? t.quit : t.reduce}</span>
        </span>
        <span className="habit-amount num">{money ? `${app.common.chf} ${chf(saved, 0)}` : `${num(Math.max(0, avoided))} ${goal.unit}`}</span>
        <ChevronRight size={20} aria-hidden="true" className="muted" />
      </button>
      <button className="icon-btn" aria-label={t.editTitle(goal.name)} onClick={() => setEdit(true)}>
        <Pencil size={18} aria-hidden="true" />
      </button>
      {edit && <EditSheet goal={goal} onClose={() => setEdit(false)} />}
    </li>
  );
}

/** Bearbeiten nur im Sheet: Warum, Menge und Preis (ab heute oder rückwirkend), Ziel, Startdatum, Löschen. */
function EditSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const update = useStore((s) => s.updateGoal);
  const changeGoalRate = useStore((s) => s.changeGoalRate);
  const remove = useStore((s) => s.removeGoal);
  const events = useStore((s) => s.events);
  const today = dayKey(new Date());
  const current = rateOn(goal, today);
  const tpl = templateByKey(goal.templateKey);
  const needsPrice = !tpl.timeBased;
  const [why, setWhy] = useState(goal.why ?? '');
  const [perDay, setPerDay] = useState(String(current.perDay));
  const [price, setPrice] = useState(current.price.toFixed(2));
  const [target, setTarget] = useState(String(goal.targetPerDay ?? 0));
  const [start, setStart] = useState(startDayOf(goal));
  const [retro, setRetro] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);

  const check = checkGoalInput({ perDay, price, startDay: start, target: goal.mode === 'reduce' ? target : undefined }, today, { needsPrice });
  const rateChanged = check.values.perDay !== current.perDay || (needsPrice && check.values.price !== current.price);
  // Vorschau nur für «Rückwirkend»: so viel ändert sich am Gesparten
  const preview = useMemo(() => {
    if (!retro || !rateChanged || !check.ok) return null;
    const now = new Date();
    const next = { ...goal, rates: changeRate(goal, { perDay: check.values.perDay, price: check.values.price }, today, true) };
    return { before: goalSummary(goal, events, now).saved, after: goalSummary(next, events, now).saved };
  }, [retro, rateChanged, check.ok, check.values.perDay, check.values.price, goal, events, today]);
  const err = (k: keyof typeof check.errors) => (tried || k === 'startDay' ? check.errors[k] : undefined);

  function save() {
    setTried(true);
    if (!check.ok) {
      const first = (['perDay', 'price', 'target', 'startDay'] as const).find((k) => check.errors[k]);
      if (first) document.getElementById(`ed-${first}`)?.focus();
      return;
    }
    if (rateChanged) changeGoalRate(goal.id, { perDay: check.values.perDay, price: check.values.price }, retro);
    const old = new Date(goal.startAt);
    const [y, m, d] = start.split('-').map(Number);
    const startAt = start === startDayOf(goal) ? goal.startAt : (start === today ? new Date(y, m - 1, d, old.getHours(), old.getMinutes()) : new Date(y, m - 1, d)).toISOString();
    update(goal.id, {
      why: why.trim() || undefined,
      startAt,
      ...(goal.mode === 'reduce' ? { targetPerDay: check.values.target } : {}),
    });
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={t.editTitle(goal.name)}>
      <h2 style={{ fontSize: '1.5rem' }}>{t.editTitle(goal.name)}</h2>
      <div className="field">
        <label htmlFor="ed-why">{t.why}</label>
        <input id="ed-why" className="input" maxLength={200} value={why} placeholder={app.onboarding.whyPlaceholder} onChange={(e) => setWhy(e.target.value)} />
      </div>
      <div className="grid2">
        <Field id="ed-perDay" label={t.perDayBefore} value={perDay} onChange={setPerDay} error={err('perDay')} />
        {needsPrice && <Field id="ed-price" label={t.price} value={price} onChange={setPrice} error={err('price')} />}
      </div>
      <p className="tiny muted">{t.rateHint}</p>
      <label htmlFor="ed-retro" className="row between toggle-row">
        <span>
          <strong>{t.retro}</strong>
          <br />
          <span className="small muted">{t.retroHint}</span>
        </span>
        <input id="ed-retro" type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} />
      </label>
      {preview && (
        <p className="small strong" role="status">
          {t.preview(chf(preview.before), chf(preview.after))}
        </p>
      )}
      {goal.rates.length > 1 && (
        <details>
          <summary className="small">{t.rateHistory}</summary>
          <ul className="plain-list tiny muted">
            {goal.rates.map((r) => (
              <li key={r.validFrom}>{t.rateFrom(words.date(r.validFrom), fmt(r.perDay), chf(r.price))}</li>
            ))}
          </ul>
        </details>
      )}
      {goal.mode === 'reduce' && (
        <p className="small muted">{t.planText(fmt(rateOn(goal, startDayOf(goal)).perDay), planStages(goal).map((st) => t.planStep(st.index + 1, fmt(st.limit))))}</p>
      )}
      {goal.mode === 'reduce' && <Field id="ed-target" label={t.target} hint={t.targetHint} value={target} onChange={setTarget} error={err('target')} />}
      <div className="field">
        <label htmlFor="ed-startDay">{t.startDate}</label>
        <input
          id="ed-startDay"
          type="date"
          className="input"
          value={start}
          max={today}
          aria-invalid={!!check.errors.startDay}
          aria-describedby="ed-startDay-msg"
          onChange={(e) => setStart(e.target.value)}
        />
        <span id="ed-startDay-msg" className={check.errors.startDay ? 'field-error' : 'tiny muted'} role={check.errors.startDay ? 'alert' : undefined}>
          {check.errors.startDay ?? (start !== startDayOf(goal) ? check.warnings.startDay : '') ?? ''}
        </span>
      </div>
      <button className="btn primary block" onClick={save}>
        {app.common.save}
      </button>
      {confirm ? (
        <div className="card flat" role="alertdialog" aria-label={t.deleteHabit}>
          <p className="small">{t.deleteConfirm}</p>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setConfirm(false)}>
              {app.common.cancel}
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                remove(goal.id);
                onClose();
              }}
            >
              {t.deleteYes}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn quiet" onClick={() => setConfirm(true)}>
          {t.deleteHabit}
        </button>
      )}
    </Sheet>
  );
}

/** Mehrere Sparziele: das Gesparte füllt sie der Reihe nach. */
function Pots({ total }: { total: number }) {
  const savings = useStore((s) => s.savings);
  const addSavings = useStore((s) => s.addSavings);
  const removeSavings = useStore((s) => s.removeSavings);
  const moveSavings = useStore((s) => s.moveSavings);
  const fills = allocatePots(total, savings);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const amountNum = parseNum(amount);
  const nameError = tried && !name.trim() ? t.potNameMissing : undefined;
  const amountError = tried && (amountNum < 1 || amountNum > 1_000_000) ? t.potAmountInvalid : undefined;

  return (
    <section className="card" aria-labelledby="pots-h">
      <h2 id="pots-h" className="card-title">
        {t.pots}
      </h2>
      {fills.length > 0 ? <p className="small muted">{t.potsHint}</p> : <p className="small muted">{t.potEmpty}</p>}
      <ol className="pots">
        {fills.map((f, i) => (
          <li key={f.pot.id} className="pot">
            <Ring progress={f.progress} size={56} stroke={7} tone="gold" />
            <div className="pot-main">
              <strong className={f.progress >= 0.8 && !f.done ? 'shimmer' : ''}>{f.pot.name}</strong>
              <span className="small muted num">
                {f.done ? t.potDone : t.potLeft(chf(f.left))}
                <br />
                {t.potOf(chf(f.pot.amount, 0))}
              </span>
            </div>
            <div className="pot-actions">
              {fills.length > 1 && (
                <>
                  <button className="icon-btn" aria-label={t.potUp(f.pot.name)} disabled={i === 0} onClick={() => moveSavings(f.pot.id, -1)}>
                    ↑
                  </button>
                  <button className="icon-btn" aria-label={t.potDown(f.pot.name)} disabled={i === fills.length - 1} onClick={() => moveSavings(f.pot.id, 1)}>
                    ↓
                  </button>
                </>
              )}
              <button className="icon-btn" aria-label={t.potRemove(f.pot.name)} onClick={() => removeSavings(f.pot.id)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button className="btn outline" onClick={() => setOpen(true)}>
        {t.potNew}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={t.pots}>
      <h2 className="sheet-title">{t.potNew}</h2>
      <form
        className="stack-10"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (name.trim() && amountNum >= 1 && amountNum <= 1_000_000) {
            addSavings(name.trim().slice(0, 60), amountNum);
            setName('');
            setAmount('');
            setTried(false);
            setOpen(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="pot-name">{t.potName}</label>
          <input id="pot-name" className="input" maxLength={60} placeholder={t.potNamePlaceholder} value={name} aria-invalid={!!nameError} onChange={(e) => setName(e.target.value)} />
          {nameError && (
            <span className="field-error" role="alert">
              {nameError}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="pot-amount">{t.potAmount}</label>
          <div className="money-input">
            <span>{app.common.chf}</span>
            <input id="pot-amount" className="input num" inputMode="decimal" placeholder="150" value={amount} aria-invalid={!!amountError} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {amountError && (
            <span className="field-error" role="alert">
              {amountError}
            </span>
          )}
        </div>
        <button className="btn primary block" type="submit">
          {t.potAdd}
        </button>
      </form>
        </Sheet>
      )}
    </section>
  );
}
