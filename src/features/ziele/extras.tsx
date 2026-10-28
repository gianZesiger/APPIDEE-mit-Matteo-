import { useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { badgeList } from '../../domain/milestones';
import { CHALLENGE_DAYS, challengeHash, MIN_PATTERN_ENTRIES, patterns, suggestTriggers } from '../../domain/insights';
import type { Goal } from '../../domain/types';
import { app, words } from '../../i18n/de-CH';
import { badgeLabel } from '../shared/celebrate';

const t = app.ziele;

/** Wenn-dann-Pläne mit Vorschlägen aus den eigenen Auslösern. */
export function Plans() {
  const plans = useStore((s) => s.plans);
  const events = useStore((s) => s.events);
  const cravings = useStore((s) => s.cravings);
  const addPlan = useStore((s) => s.addPlan);
  const removePlan = useStore((s) => s.removePlan);
  const [when, setWhen] = useState('');
  const [then, setThen] = useState('');
  const ideas = useMemo(() => suggestTriggers(patterns(events, cravings), app.triggers).slice(0, 4), [events, cravings]);
  const used = new Set(plans.map((p) => p.when));
  return (
    <section className="card" aria-labelledby="plans-h">
      <h2 id="plans-h" className="card-title">
        {t.plans}
      </h2>
      <p className="small muted">{t.plansHint}</p>
      {plans.length > 0 && (
        <ul className="plain-list stack-10">
          {plans.map((p) => (
            <li key={p.id} className="plan-item row between">
              <span>{app.planIdeas.joined(p.when, p.then)}</span>
              <button className="icon-btn" aria-label={`${t.planRemove}: ${p.when}`} onClick={() => removePlan(p.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="stack-8">
        <span className="label">{t.planSuggest}</span>
        <div className="chiprow">
          {ideas
            .filter((tr) => !used.has(app.planIdeas.when[tr]))
            .map((tr) => (
              <button
                key={tr}
                className="dchip"
                onClick={() => {
                  setWhen(app.planIdeas.when[tr]);
                  setThen(app.planIdeas.then[tr]);
                }}
              >
                {tr}
              </button>
            ))}
        </div>
      </div>
      <form
        className="stack-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (!when.trim() || !then.trim()) return;
          addPlan(when, then);
          setWhen('');
          setThen('');
        }}
      >
        <div className="field">
          <label htmlFor="plan-when">{t.planWhen}</label>
          <input id="plan-when" className="input" maxLength={60} value={when} onChange={(e) => setWhen(e.target.value)} placeholder={app.planIdeas.when.Stress} />
        </div>
        <div className="field">
          <label htmlFor="plan-then">{t.planThen}</label>
          <input id="plan-then" className="input" maxLength={120} value={then} onChange={(e) => setThen(e.target.value)} placeholder={app.planIdeas.then.Stress} />
        </div>
        <button className="btn ghost" type="submit">
          {t.planAdd}
        </button>
      </form>
    </section>
  );
}

/** Muster aus Ausrutschern und Verlangen: Auslöser, Tageszeit, Wochentag. Nur für die Person. */
export function Patterns() {
  const events = useStore((s) => s.events);
  const cravings = useStore((s) => s.cravings);
  const p = useMemo(() => patterns(events, cravings), [events, cravings]);
  const pt = app.patternsText;
  const max = Math.max(1, ...p.weekdays);
  return (
    <section className="card" aria-labelledby="patterns-h">
      <h2 id="patterns-h" className="card-title">
        {t.patterns}
      </h2>
      <p className="small muted">{t.patternsPrivate}</p>
      {p.total < MIN_PATTERN_ENTRIES ? (
        <p className="small">{t.patternsEmpty}</p>
      ) : (
        <>
          <dl className="facts">
            <div>
              <dt>{pt.trigger}</dt>
              <dd>{p.triggers[0] ? `${p.triggers[0].name} (${pt.times(p.triggers[0].count)})` : pt.none}</dd>
            </div>
            <div>
              <dt>{pt.part}</dt>
              <dd>{p.parts[0] ? pt.parts[p.parts[0].part] : pt.none}</dd>
            </div>
            <div>
              <dt>{pt.weekday}</dt>
              <dd>{p.topWeekday !== null ? pt.weekdays[p.topWeekday] : pt.none}</dd>
            </div>
          </dl>
          <div className="wdbars" role="img" aria-label={pt.weekdays.map((d, i) => `${d}: ${p.weekdays[i]}`).join(', ')}>
            {p.weekdays.map((n, i) => (
              <div key={i} className="wd">
                <i style={{ height: `${Math.max(6, (n / max) * 100)}%` }} className={n === 0 ? 'off' : ''} />
                <span>{pt.weekdaysShort[i]}</span>
              </div>
            ))}
          </div>
          <p className="tiny muted">{pt.basis(p.total)}</p>
        </>
      )}
    </section>
  );
}

/** Meilensteine und Abzeichen. Jeder wird nur einmal gefeiert. */
export function Badges({ goals, saved }: { goals: { best: number; hasMoney: boolean }[]; saved: number }) {
  const cravings = useStore((s) => s.cravings.length);
  const trainings = useStore((s) => s.workouts.filter((w) => !w.rest).length);
  const list = badgeList({
    bestDays: Math.max(0, ...goals.map((g) => g.best)),
    saved,
    cravings,
    trainings,
    hasMoney: goals.some((g) => g.hasMoney),
  });
  return (
    <section className="card" aria-labelledby="badges-h">
      <h2 id="badges-h" className="card-title">
        {t.badges}
      </h2>
      <p className="small muted">{t.badgesHint}</p>
      <ul className="badges">
        {list.map((b) => (
          <li key={b.key} className={`badge ${b.kind} ${b.reached ? 'on' : ''}`}>
            <span className="badge-ico" aria-hidden="true">
              {b.kind === 'days' ? '🌊' : b.kind === 'money' ? '🪙' : b.kind === 'craving' ? '🌿' : '👟'}
            </span>
            <span className="badge-label">{badgeLabel(b)}</span>
            {!b.reached && <span className="sr-only">, {app.badges.locked}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Challenge per Link, ohne Server: der Link enthält nur Gewohnheit und Tage. */
export function Challenge({ goals }: { goals: Goal[] }) {
  const activeId = useStore((s) => s.activeGoalId);
  const [goalId, setGoalId] = useState(activeId ?? goals[0]?.id);
  const [days, setDays] = useState(14);
  const [msg, setMsg] = useState<string | null>(null);
  const goal = goals.find((g) => g.id === goalId) ?? goals[0];
  if (!goal) return null;
  const url = `${location.origin}/app/${challengeHash(goal.templateKey, days)}`;
  const text = t.challengeMessage(goal.name, days, url);
  return (
    <section className="card" aria-labelledby="challenge-h">
      <h2 id="challenge-h" className="card-title">
        {t.challenge}
      </h2>
      <p className="small muted">{t.challengeText}</p>
      {goals.length > 1 && (
        <div className="chiprow" role="radiogroup" aria-label={t.habits}>
          {goals.map((g) => (
            <button key={g.id} role="radio" aria-checked={g.id === goal.id} className={`dchip ${g.id === goal.id ? 'on' : ''}`} onClick={() => setGoalId(g.id)}>
              {g.emoji} {g.name}
            </button>
          ))}
        </div>
      )}
      <div className="chiprow" role="radiogroup" aria-label={t.challengeDays}>
        {CHALLENGE_DAYS.map((d) => (
          <button key={d} role="radio" aria-checked={days === d} className={`dchip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>
            {words.days(d)}
          </button>
        ))}
      </div>
      <button
        className="btn ghost"
        onClick={async () => {
          const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
          if (nav.share) {
            try {
              await nav.share({ text, url });
              return;
            } catch (e) {
              if ((e as Error)?.name === 'AbortError') return;
            }
          }
          try {
            await navigator.clipboard.writeText(text);
            setMsg(t.challengeCopied);
          } catch {
            setMsg(url);
          }
        }}
      >
        {t.challengeShare}
      </button>
      {msg && (
        <p className="small selectable" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
