import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../app/store';
import { useIntent } from '../../app/intent';
import { EFFORT_RPE, SPORTS, effortOf, isDuplicate, isMonday, sportByKey, sportStats, type Workout } from '../../domain/sport';
import { addDays, dayKey } from '../../domain/time';
import { Ring, Sheet, Toast, useNow } from '../../ui/ui';
import { CountUpInline } from '../../ui/CountUpInline';
import { spark } from '../../ui/motion';
import { app, words } from '../../i18n/de-CH';
import { useBadgeCelebration } from '../shared/celebrate';

const t = app.sport;
const DURATIONS = [15, 30, 45, 60, 90];
const FEEL: { v: 1 | 2 | 3 | 4; e: string }[] = [
  { v: 1, e: '🪫' },
  { v: 2, e: '🙂' },
  { v: 3, e: '😊' },
  { v: 4, e: '🔥' },
];
const sportName = (k: string) => app.sports[k] ?? app.sports.andere;
const shortDate = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(day + 'T12:00:00').toLocaleDateString('de-CH', opts);

type ToastState = { text: string; undo?: Workout } | null;

export default function Sport() {
  const now = useNow(30_000);
  const workouts = useStore((s) => s.workouts);
  const goals = useStore((s) => s.goals);
  const goalMin = useStore((s) => s.sportGoalMin);
  const setGoal = useStore((s) => s.setSportGoal);
  const removeWorkout = useStore((s) => s.removeWorkout);
  const restoreWorkout = useStore((s) => s.restoreWorkout);
  const addWorkout = useStore((s) => s.addWorkout);
  const firstStart = goals.map((g) => dayKey(new Date(g.startAt))).sort()[0];
  const firstGoal = goals.find((g) => dayKey(new Date(g.startAt)) === firstStart);
  const cravings = useStore((s) => s.cravings);
  const st = useMemo(() => sportStats(workouts, now, goalMin, firstStart, cravings), [workouts, now, goalMin, firstStart, cravings]);
  const [sheet, setSheet] = useState(false);
  // Kurzbefehl «Training» öffnet den Eintrag gleich
  useIntent('training', () => setSheet(true));
  const [toast, setToast] = useState<ToastState>(null);
  const [editGoal, setEditGoal] = useState(false);
  useBadgeCelebration((text) => setToast({ text }));
  const today = dayKey(now);
  const recent = [...workouts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const maxBar = Math.max(goalMin, ...st.last8.map((w) => w.minutes));
  const restToday = workouts.some((w) => w.rest && w.day === today);
  // Ruhetag und Training am selben Tag schliessen sich aus
  const trainedToday = workouts.some((w) => !w.rest && w.day === today);
  const progress = goalMin > 0 ? st.last7.minutes / goalMin : 0;

  // Montag ist nie nur «0»: ein freundlicher Blick auf die letzte Woche
  let message: string;
  if (isMonday(today) && st.weekMinutes === 0) message = t.weekStart(words.minutesLong(st.lastWeekMinutes), st.lastWeekReached);
  else if (progress >= 1) message = t.weekGoalReached;
  else if (st.last7.minutes === 0) message = t.firstSteps;
  else message = t.remaining(goalMin - st.last7.minutes);

  function remove(w: Workout) {
    removeWorkout(w.id);
    setToast({ text: t.removed, undo: w });
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="page-title">{t.h1}</h1>
      </div>

      <section className="card hero-card tilt">
        <h2 className="sr-only">{t.last7}</h2>
        <Ring progress={progress} size={250} stroke={18} tone="moss" label={t.last7} valueText={`${words.minutes(st.last7.minutes)} ${t.ofGoal(goalMin)}`}>
          <span className="eyebrow">{t.last7}</span>
          <span className="hero-money num" style={{ fontSize: 54 }} aria-hidden="true">
            <CountUpInline value={st.last7.minutes} />
          </span>
          <span className="small muted" aria-hidden="true">
            {t.ofGoal(goalMin)}
          </span>
        </Ring>
        <div className="dots7" role="img" aria-label={t.dots(st.last7.activeDays, st.last7.restDays)}>
          {st.last7.days.map((d) => {
            const active = workouts.some((w) => w.day === d && !w.rest);
            const rest = workouts.some((w) => w.day === d && w.rest);
            return <i key={d} className={`${active ? 'on' : rest ? 'rest' : ''} ${d === today ? 'today' : ''}`} />;
          })}
        </div>
        <p className="center strong">{message}</p>
        {st.todayMinutes > 180 && <p className="small muted center">{t.highLoad}</p>}
        <button className="btn moss block" onClick={() => setSheet(true)}>
          {t.add}
        </button>
        {!restToday && !trainedToday && (
          <button
            className="btn quiet"
            onClick={() => {
              addWorkout({ day: today, at: new Date().toISOString(), sport: 'andere', minutes: 0, rest: true });
              setToast({ text: t.restSaved });
            }}
          >
            {t.restToday}
          </button>
        )}
      </section>

      {firstGoal && st.sinceQuit > 0 && (
        <section className="card flat reveal row" style={{ gap: 14 }}>
          <span style={{ fontSize: 34 }} className="float" aria-hidden="true">
            {firstGoal.emoji}
          </span>
          <div>
            <span className="eyebrow">{t.sinceQuit(firstGoal.name)}</span>
            <p className="strong" style={{ fontSize: 18 }}>
              {t.sinceQuitText(st.sinceQuit, st.cravingsSinceQuit)}
            </p>
          </div>
        </section>
      )}

      <section className="card reveal" aria-labelledby="hist-h">
        <div className="row between">
          <h2 id="hist-h" className="card-title">
            {t.history}
          </h2>
          <button className="linkbtn" aria-expanded={editGoal} onClick={() => setEditGoal((v) => !v)}>
            {t.goalLink(goalMin)}
          </button>
        </div>
        {editGoal && (
          <div className="field">
            <label htmlFor="sport-goal">{t.goalLabel}</label>
            <input id="sport-goal" type="range" min={30} max={600} step={10} value={goalMin} onChange={(e) => setGoal(+e.target.value)} />
            <span className="tiny muted">
              {t.who}{' '}
              <a href="https://www.ncbi.nlm.nih.gov/books/NBK566048/" target="_blank" rel="noreferrer" style={{ color: 'var(--calm)' }}>
                {t.source}
              </a>
            </span>
          </div>
        )}
        <div className="weekbars" role="img" aria-label={st.last8.map((w) => `${shortDate(w.start, { day: 'numeric', month: 'long' })}: ${words.minutes(w.minutes)}`).join(', ')}>
          <div className="goal-line" style={{ bottom: `calc(${(goalMin / maxBar) * 100}% * 0.78 + 18px)` }}>
            <span>{t.goalLine}</span>
          </div>
          {st.last8.map((w, i) => (
            <div key={w.start} className="wb">
              <i className={`${w.minutes === 0 ? 'off' : ''} ${i === 7 ? 'cur' : ''}`} style={{ height: `${Math.max(3, (w.minutes / maxBar) * 78)}%`, animationDelay: `${i * 70}ms` }} />
              <span>{shortDate(w.start, { day: 'numeric', month: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid2 reveal" aria-label={t.records}>
        {[
          { v: words.minutesLong(st.longest?.minutes ?? 0), l: t.longest, e: '⏱️' },
          { v: words.minutesLong(st.bestWeek), l: t.bestWeek, e: '🏔️' },
        ].map((x) => (
          <div key={x.l} className="card tilt record">
            <span aria-hidden="true" style={{ fontSize: 20 }}>
              {x.e}
            </span>
            <span className="num record-v">{x.v}</span>
            <span className="tiny muted">{x.l}</span>
          </div>
        ))}
      </section>

      <section className="card reveal" aria-labelledby="recent-h">
        <h2 id="recent-h" className="card-title">
          {t.recent}
        </h2>
        {recent.length === 0 ? (
          <p className="small muted">{t.nothing}</p>
        ) : (
          <ul className="plain-list">
            {recent.map((w) => (
              <WorkoutRow key={w.id} w={w} onRemove={() => remove(w)} />
            ))}
          </ul>
        )}
      </section>

      {sheet && (
        <AddWorkout
          onClose={() => setSheet(false)}
          onSaved={(w, reached) => {
            if (reached) {
              setTimeout(() => spark(undefined, undefined, { count: 80 }), 150);
              setToast({ text: t.weekReached });
            } else setToast({ text: t.saved(sportByKey(w.sport).emoji, words.minutesLong(w.minutes)) });
          }}
        />
      )}
      {toast && (
        <Toast
          text={toast.text}
          onDone={() => setToast(null)}
          action={toast.undo ? { label: app.common.undo, onClick: () => restoreWorkout(toast.undo!) } : undefined}
        />
      )}
    </div>
  );
}

/** Eintrag: nach links wischen oder ✕ löscht, mit «Rückgängig» in der Meldung. */
function WorkoutRow({ w, onRemove }: { w: Workout; onRemove: () => void }) {
  const s = sportByKey(w.sport);
  const name = w.rest ? t.rest : sportName(w.sport);
  const date = shortDate(w.day, { weekday: 'short', day: 'numeric', month: 'short' });
  const effort = effortOf(w.rpe);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <li
      className="workout-row"
      style={dx ? { transform: `translateX(${dx}px)`, opacity: 1 + dx / 240 } : undefined}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const x = e.clientX - start.current.x;
        if (Math.abs(e.clientY - start.current.y) > 24) {
          start.current = null;
          setDx(0);
        } else setDx(Math.min(0, x));
      }}
      onPointerUp={() => {
        if (dx < -90) onRemove();
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <span className="ico" aria-hidden="true" style={w.rest ? { background: 'var(--calm-soft)' } : undefined}>
        {w.rest ? '😌' : s.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{name}</strong>
        <p className="tiny muted">
          {date}
          {!w.rest && ` · ${words.minutesLong(w.minutes)}`}
          {w.distanceKm ? ` · ${t.km(String(w.distanceKm))}` : ''}
          {effort ? ` · ${t.efforts[effort]}` : ''}
        </p>
      </div>
      <button className="icon-btn" aria-label={t.removeLabel(`${name}, ${date}`)} onClick={onRemove}>
        ✕
      </button>
    </li>
  );
}

function AddWorkout({ onClose, onSaved }: { onClose: () => void; onSaved: (w: Omit<Workout, 'id'>, reachedGoal: boolean) => void }) {
  const workouts = useStore((s) => s.workouts);
  const addWorkout = useStore((s) => s.addWorkout);
  const goalMin = useStore((s) => s.sportGoalMin);
  const real = workouts.filter((w) => !w.rest && w.sport !== 'bewegung');
  const last = [...real].sort((a, b) => b.at.localeCompare(a.at))[0];
  const [sport, setSport] = useState(last?.sport ?? 'laufen');
  const [minutes, setMinutes] = useState(last?.minutes ?? 30);
  const todayKey = dayKey(new Date());
  const [day, setDay] = useState(todayKey);
  const [dupWarned, setDupWarned] = useState(false);
  const [more, setMore] = useState(false);
  const [km, setKm] = useState('');
  const [effort, setEffort] = useState<1 | 2 | 3 | undefined>();
  const [feel, setFeel] = useState<1 | 2 | 3 | 4 | undefined>();
  const sp = sportByKey(sport);

  function save(w: Omit<Workout, 'id'>) {
    // Gleicher Eintrag am gleichen Tag: erst hinweisen, beim zweiten Tippen trotzdem speichern
    if (isDuplicate(workouts, w) && !dupWarned) {
      setDupWarned(true);
      return;
    }
    const now = new Date();
    const before = sportStats(workouts, now, goalMin).last7.minutes;
    addWorkout(w);
    // Gefeiert wird das Erreichen des Wochenziels, nie viel Training oder hohe Intensität
    const reached = before < goalMin && before + w.minutes >= goalMin;
    onSaved(w, reached);
    onClose();
  }

  function build(): Omit<Workout, 'id'> {
    const now = new Date();
    const d = parseFloat(km.replace(',', '.'));
    const [yy, mm, dd] = day.split('-').map(Number);
    return {
      day,
      at: day === dayKey(now) ? now.toISOString() : new Date(yy, mm - 1, dd, 18).toISOString(),
      sport,
      minutes,
      distanceKm: sp.distance && d > 0 && d <= 1000 ? +d.toFixed(2) : undefined,
      rpe: effort ? EFFORT_RPE[effort] : undefined,
      feeling: feel,
    };
  }

  return (
    <Sheet onClose={onClose} label={t.sheetTitle}>
      <div className="row between">
        <h2 style={{ fontSize: 24 }}>{t.sheetTitle}</h2>
        {last && (
          <button
            className="btn sm ghost"
            onClick={() => {
              const now = new Date();
              save({ day: dayKey(now), at: now.toISOString(), sport: last.sport, minutes: last.minutes, distanceKm: last.distanceKm });
            }}
          >
            ↺ {t.again}
          </button>
        )}
      </div>
      <div className="sport-grid" role="radiogroup" aria-label={t.sportLabel}>
        {SPORTS.filter((s) => s.key !== 'bewegung').map((s) => (
          <button key={s.key} role="radio" aria-checked={sport === s.key} className={`sport-pick ${sport === s.key ? 'on' : ''}`} onClick={() => setSport(s.key)}>
            <span className="e" aria-hidden="true">
              {s.emoji}
            </span>
            {sportName(s.key)}
          </button>
        ))}
      </div>
      <div className="field">
        <span className="label">{t.duration}</span>
        <div className="chiprow">
          {DURATIONS.map((m) => (
            <button key={m} className={`dchip ${minutes === m ? 'on' : ''}`} aria-pressed={minutes === m} aria-label={words.minutes(m)} onClick={() => setMinutes(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="stepper" style={{ marginTop: 6 }}>
          <button aria-label={t.minus5} onClick={() => setMinutes((m) => Math.max(5, m - 5))} style={{ width: 52, height: 52 }}>
            −
          </button>
          <span className="val num" style={{ fontSize: 52 }} aria-live="polite">
            {minutes}
            <span style={{ fontSize: 18 }}> {t.minutesUnit(minutes)}</span>
          </span>
          <button aria-label={t.plus5} onClick={() => setMinutes((m) => Math.min(600, m + 5))} style={{ width: 52, height: 52 }}>
            +
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="w-day">{t.day}</label>
        <div className="row">
          <div className="chiprow">
            {[todayKey, addDays(todayKey, -1)].map((k, i) => (
              <button key={k} className={`dchip ${day === k ? 'on' : ''}`} aria-pressed={day === k} onClick={() => setDay(k)}>
                {i === 0 ? t.today : t.yesterday}
              </button>
            ))}
          </div>
          <input
            id="w-day"
            type="date"
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            value={day}
            max={todayKey}
            min={addDays(todayKey, -365)}
            onChange={(e) => {
              setDay(e.target.value || todayKey);
              setDupWarned(false);
            }}
          />
        </div>
      </div>
      {!more ? (
        <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>
          {t.more}
        </button>
      ) : (
        <div className="card flat" style={{ gap: 14 }}>
          {sp.distance && (
            <div className="field">
              <label htmlFor="w-km">{t.distance}</label>
              <input id="w-km" className="input num" inputMode="decimal" placeholder={t.distancePlaceholder} value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
          )}
          <div className="field">
            <span className="label">{t.effort}</span>
            <div className="chiprow" role="radiogroup" aria-label={t.effort}>
              {([1, 2, 3] as const).map((v) => (
                <button key={v} role="radio" aria-checked={effort === v} className={`dchip ${effort === v ? 'on' : ''}`} onClick={() => setEffort(effort === v ? undefined : v)}>
                  {t.efforts[v]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">{t.feeling}</span>
            <div className="grid4">
              {FEEL.map((f) => (
                <button key={f.v} className={`option feel ${feel === f.v ? 'on' : ''}`} aria-pressed={feel === f.v} onClick={() => setFeel(feel === f.v ? undefined : f.v)}>
                  <span style={{ fontSize: 22 }} aria-hidden="true">
                    {f.e}
                  </span>
                  <span className="tiny">{t.feelings[f.v]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {dupWarned && (
        <p className="field-error" role="alert">
          {t.duplicate}
        </p>
      )}
      <button className="btn moss block" onClick={() => save(build())}>
        {app.common.save}
      </button>
    </Sheet>
  );
}
