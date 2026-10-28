import { useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { computeStats } from '../../domain/stats';
import { planSteps, weekIndex } from '../../domain/reduction';
import { allocatePots } from '../../domain/savings';
import { moneyCompare } from '../../domain/compare';
import { chf, chfSpeech, num } from '../../domain/format';
import { dayKey } from '../../domain/time';
import { templateByKey } from '../../domain/templates';
import type { Goal } from '../../domain/types';
import { Ring, useNow } from '../../ui/ui';
import { Odometer } from '../../ui/Odometer';
import { app } from '../../i18n/de-CH';
import { Badges, Challenge, Patterns, Plans } from './extras';

const t = app.ziele;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));
const parseNum = (v: string) => Math.max(0, parseFloat(v.replace(',', '.')) || 0);

export default function Ziele({ goNew, goToday }: { goNew: () => void; goToday: () => void }) {
  const goals = useStore((s) => s.goals);
  const events = useStore((s) => s.events);
  const tick = useNow(15_000);
  const now = useMemo(() => new Date(Math.max(tick.getTime(), Date.now())), [tick, events]);
  const all = useMemo(() => goals.map((g) => ({ g, s: computeStats(g, events, now) })), [goals, events, now]);
  const total = all.reduce((sum, x) => sum + x.s.saved, 0);
  const cmp = moneyCompare(total);

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="page-title">{t.h1}</h1>
        <button className="btn sm primary" onClick={goNew}>
          {t.add}
        </button>
      </div>

      <section className="card" style={{ gap: 6 }}>
        <span className="eyebrow">{t.total}</span>
        <div className="hero-money num" style={{ fontSize: 44 }}>
          <span className="cur" aria-hidden="true">
            {app.common.chf}
          </span>
          <Odometer value={chf(total)} srText={chfSpeech(total)} />
        </div>
        {cmp && <p className="small muted">{t.compare(cmp.count, app.things[cmp.key])}</p>}
      </section>

      <h2 className="section-title">{t.habits}</h2>
      {all.map(({ g, s }) => (
        <HabitCard key={g.id} goal={g} goodDays={s.winDays} saved={s.saved} avoided={s.avoided} best={s.bestStreak} goToday={goToday} />
      ))}

      <Pots total={total} />
      <Plans />
      <Patterns />
      <Badges goals={all.map((x) => ({ best: x.s.bestStreak, hasMoney: x.g.price > 0 }))} saved={total} />
      <Challenge goals={goals} />
    </div>
  );
}

function HabitCard({ goal, goodDays, saved, avoided, best, goToday }: { goal: Goal; goodDays: number; saved: number; avoided: number; best: number; goToday: () => void }) {
  const setActive = useStore((s) => s.setActive);
  const money = goal.price > 0 && !templateByKey(goal.templateKey).timeBased;
  return (
    <section className="card tilt reveal" aria-label={goal.name}>
      <button
        className="row between plain"
        onClick={() => {
          setActive(goal.id);
          goToday();
        }}
      >
        <span className="row">
          <span style={{ fontSize: 30 }} aria-hidden="true">
            {goal.emoji}
          </span>
          <span className="stack-2">
            <strong className="habit-name">{goal.name}</strong>
            <span className="tiny muted">{goal.mode === 'quit' ? t.quit : t.reduce}</span>
          </span>
        </span>
        <span className="muted" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="grid3">
        <div className="stat">
          <span className="v num">{goodDays}</span>
          <span className="l">{t.goodDays}</span>
        </div>
        <div className="stat">
          <span className="v num">{money ? chf(saved, 0) : num(avoided)}</span>
          <span className="l">{money ? `${app.common.chf} ${t.saved}` : t.avoided(goal.unit)}</span>
        </div>
        <div className="stat">
          <span className="v num">{best}</span>
          <span className="l">{t.bestStreak}</span>
        </div>
      </div>
      {goal.mode === 'reduce' && <ReducePlan goal={goal} />}
      <div className="why">
        <span className="eyebrow">{t.why}</span>
        <p className={goal.why ? '' : 'muted small'}>{goal.why ? `«${goal.why}»` : t.whyEmpty}</p>
      </div>
      <GoalEdit goal={goal} />
    </section>
  );
}

function ReducePlan({ goal }: { goal: Goal }) {
  const update = useStore((s) => s.updateGoal);
  const steps = planSteps(goal.perDay, goal.targetPerDay ?? 0, goal.planWeeks ?? 4, goal.perDay % 1 ? 0.5 : 1);
  const wi = Math.max(0, Math.min(weekIndex(goal, dayKey(new Date())) - (goal.planExtraWeeks ?? 0), steps.length - 1));
  return (
    <div className="card flat" style={{ gap: 6 }}>
      <span className="eyebrow">{t.plan}</span>
      <p className="small">{t.planText(fmt(goal.perDay), steps.map((v, i) => t.planStep(i + 1, fmt(v))))}</p>
      <p className="small" style={{ fontWeight: 700 }}>
        {t.planNow(wi + 1)}
      </p>
      <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => update(goal.id, { planExtraWeeks: (goal.planExtraWeeks ?? 0) + 1 })}>
        {t.extend}
      </button>
    </div>
  );
}

function GoalEdit({ goal }: { goal: Goal }) {
  const update = useStore((s) => s.updateGoal);
  const remove = useStore((s) => s.removeGoal);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!open)
    return (
      <button className="btn quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        {t.edit}
      </button>
    );
  return (
    <div className="stack-10">
      <div className="field">
        <label htmlFor={`why-${goal.id}`}>{t.why}</label>
        <input
          id={`why-${goal.id}`}
          className="input"
          maxLength={200}
          defaultValue={goal.why ?? ''}
          placeholder={app.onboarding.whyPlaceholder}
          onBlur={(e) => update(goal.id, { why: e.target.value.trim() || undefined })}
        />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor={`pd-${goal.id}`}>{t.perDayBefore}</label>
          <input id={`pd-${goal.id}`} className="input num" inputMode="decimal" defaultValue={goal.perDay} onBlur={(e) => update(goal.id, { perDay: Math.min(500, parseNum(e.target.value)) })} />
        </div>
        <div className="field">
          <label htmlFor={`pr-${goal.id}`}>{t.price}</label>
          <input id={`pr-${goal.id}`} className="input num" inputMode="decimal" defaultValue={goal.price} onBlur={(e) => update(goal.id, { price: Math.min(500, parseNum(e.target.value)) })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`st-${goal.id}`}>{t.startDate}</label>
        <input
          id={`st-${goal.id}`}
          type="date"
          className="input"
          defaultValue={dayKey(new Date(goal.startAt))}
          max={dayKey(new Date())}
          onBlur={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split('-').map(Number);
            const old = new Date(goal.startAt);
            const next = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
            const min = Date.now() - 5 * 365 * 86_400_000;
            if (Number.isNaN(next.getTime()) || next.getTime() > Date.now() || next.getTime() < min) {
              e.target.value = dayKey(old);
              return;
            }
            update(goal.id, { startAt: next.toISOString() });
          }}
        />
      </div>
      {confirm ? (
        <div className="card flat" role="alertdialog" aria-label={t.deleteHabit}>
          <p className="small">{t.deleteConfirm}</p>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setConfirm(false)}>
              {app.common.cancel}
            </button>
            <button className="btn sm danger" onClick={() => remove(goal.id)}>
              {t.deleteYes}
            </button>
          </div>
        </div>
      ) : (
        <div className="row between">
          <button className="btn sm ghost" onClick={() => setOpen(false)}>
            {app.common.done}
          </button>
          <button className="btn quiet" onClick={() => setConfirm(true)}>
            {t.deleteHabit}
          </button>
        </div>
      )}
    </div>
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
      <form
        className="stack-10"
        onSubmit={(e) => {
          e.preventDefault();
          const a = parseNum(amount);
          if (name.trim() && a >= 1) {
            addSavings(name.trim().slice(0, 60), Math.min(1_000_000, a));
            setName('');
            setAmount('');
          }
        }}
      >
        <div className="field">
          <label htmlFor="pot-name">{t.potName}</label>
          <input id="pot-name" className="input" maxLength={60} placeholder={t.potNamePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pot-amount">{t.potAmount}</label>
          <div className="money-input">
            <span>{app.common.chf}</span>
            <input id="pot-amount" className="input num" inputMode="decimal" placeholder="150" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <button className="btn ghost" type="submit">
          {t.potAdd}
        </button>
      </form>
    </section>
  );
}
