import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../app/store';
import { useIntent } from '../../app/intent';
import type { Tab } from '../../app/App';
import { goalSummary, totalSaved } from '../../domain/stats';
import { nextDayMilestone, reconcileMilestones } from '../../domain/milestones';
import { allocatePots, currentPot } from '../../domain/savings';
import { lastWeekReview, shareContent } from '../../domain/insights';
import { chf, chfSpeech } from '../../domain/format';
import { isMonday } from '../../domain/sport';
import { dayKey, daysBetween } from '../../domain/time';
import { templateByKey } from '../../domain/templates';
import { hasMoney } from '../../domain/rates';
import { backupDue, installHint } from '../../domain/reminders';
import { isIos, isStandalone, useInstallPrompt } from '../../app/pwa';
import type { Goal, UseEvent } from '../../domain/types';
import { Ring, Toast, useNow } from '../../ui/ui';
import { Odometer } from '../../ui/Odometer';
import { spark } from '../../ui/motion';
import { app, words } from '../../i18n/de-CH';
import { celebrationText, useBadgeCelebration } from '../shared/celebrate';
import type { ShareOption } from '../share/ShareSheet';
import { DaySheet, SlipSheet, SosSheet } from './sheets';

const ShareSheet = lazy(() => import('../share/ShareSheet'));
const t = app.heute;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

export default function Heute({ go }: { go: (t: Tab) => void }) {
  const goals = useStore((s) => s.goals);
  const activeId = useStore((s) => s.activeGoalId);
  const goal = goals.find((g) => g.id === activeId) ?? goals[0];
  if (!goal) return null;
  return (
    <div className="screen">
      <h1 className="sr-only">{t.h1}</h1>
      <GoalToday key={goal.id} goal={goal} go={go} />
    </div>
  );
}

/** Live-Betrag als eigene kleine Komponente: nur sie rendert jede Sekunde neu. */
function LiveSaved({ goal, events }: { goal: Goal; events: UseEvent[] }) {
  const now = useNow(1000);
  const s = goalSummary(goal, events, now);
  const tpl = templateByKey(goal.templateKey);
  if (tpl.timeBased) {
    return (
      <div className="hero-money num live" style={{ fontSize: '2.5rem' }}>
        {words.minutesLong(Math.max(0, Math.floor(s.avoided * 60)))}
      </div>
    );
  }
  if (!hasMoney(goal)) {
    return (
      <div className="hero-money num live">
        {Math.max(0, Math.floor(s.avoided))}
        <span className="cur" style={{ verticalAlign: 'baseline', marginLeft: 6 }}>
          {goal.unit}
        </span>
      </div>
    );
  }
  const money = chf(s.saved, 2);
  const [int, cents] = money.split('.');
  return (
    <div className="hero-money num live">
      <span className="cur" aria-hidden="true">
        {app.common.chf}
      </span>
      <Odometer value={int} srText={t.savedSpeech(chfSpeech(s.saved))} />
      <span className="cents">
        <span aria-hidden="true">.</span>
        <Odometer value={cents} srText="" />
      </span>
    </div>
  );
}

/** Genaue Zeit mit Sekunden, nur wenn aufgeklappt. */
function LiveExact({ from }: { from: number }) {
  const now = useNow(1000);
  return <span className="tiny muted num">{words.exact(now.getTime() - from)}</span>;
}

type Share = { headline: string; options: ShareOption[] } | null;

const MOODS = [
  [1, '😮‍💨'],
  [2, '🙂'],
  [3, '💪'],
] as const;

function GoalToday({ goal, go }: { goal: Goal; go: (t: Tab) => void }) {
  // Kurzbefehl «Check-in»: zur Check-in-Karte und den Fokus auf die erste Wahl
  useIntent('checkin', () => {
    const card = document.getElementById('checkin-h')?.closest('section');
    card?.scrollIntoView({ block: 'center' });
    card?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  });
  // Alles ausser dem Live-Betrag reicht alle 15 Sekunden
  const tick = useNow(15_000);
  const events = useStore((s) => s.events);
  const goals = useStore((s) => s.goals);
  // Neue Einträge sofort mitzählen, nicht erst beim nächsten Takt
  const now = useMemo(() => new Date(Math.max(tick.getTime(), Date.now())), [tick, events, goals]);
  const checkins = useStore((s) => s.checkins);
  const savings = useStore((s) => s.savings);
  const workouts = useStore((s) => s.workouts);
  const sportGoal = useStore((s) => s.sportGoalMin);
  const weeklyReview = useStore((s) => s.weeklyReview);
  const reviewSeen = useStore((s) => s.reviewSeen);
  const markReviewSeen = useStore((s) => s.markReviewSeen);
  const seen = useStore((s) => s.seenMilestones[goal.id]);
  const setMilestones = useStore((s) => s.setMilestones);
  const setActive = useStore((s) => s.setActive);
  const addEvent = useStore((s) => s.addEvent);
  const undo = useStore((s) => s.undoLastEvent);
  const checkIn = useStore((s) => s.checkIn);
  const setNote = useStore((s) => s.setNote);
  const demo = useStore((s) => s.demo);
  const lastBackup = useStore((s) => s.lastBackup);
  const backupSnoozed = useStore((s) => s.backupSnoozed);
  const snoozeBackup = useStore((s) => s.snoozeBackup);
  const installSeen = useStore((s) => s.installHintSeen);
  const dismissInstall = useStore((s) => s.dismissInstall);
  const promptInstall = useInstallPrompt();
  const stats = useMemo(() => goalSummary(goal, events, now), [goal, events, now]);
  const total = useMemo(() => totalSaved(goals, events, now), [goals, events, now]);
  const tpl = templateByKey(goal.templateKey);
  const money = hasMoney(goal);

  const [sheet, setSheet] = useState<null | 'slip' | 'sos'>(null);
  const [dayEdit, setDayEdit] = useState<string | null>(null);
  const [share, setShare] = useState<Share>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exact, setExact] = useState(false);
  // Nach dem Einchecken: bei «Zäh» erst fragen, dann ein Satz fürs Tagebuch
  const [stage, setStage] = useState<null | 'ask' | 'journal'>(null);
  const [changing, setChanging] = useState(false);
  const [note, setNoteText] = useState('');

  useBadgeCelebration(setToast);

  // Meilensteine abgleichen: neue feiern, nicht mehr erreichte zurücksetzen
  useEffect(() => {
    const r = reconcileMilestones(stats.streak, stats.saved, seen ?? [], money);
    if (!r.changed) return;
    setMilestones(goal.id, r.keep);
    if (r.celebrate) {
      setToast(celebrationText(r.celebrate));
      setTimeout(() => spark(undefined, undefined, { count: 90 }), 120);
    }
  }, [stats.streak, stats.saved, seen, goal.id, money, setMilestones]);

  const ms = nextDayMilestone(stats.streak);
  const today = dayKey(now);
  const todayCheck = checkins.find((c) => c.day === today);
  const strip = stats.days.slice(-14);
  const isDay1 = stats.totalDays <= 1;
  const fills = allocatePots(total, savings);
  const pot = currentPot(fills);
  const lastPot = fills.length ? fills[fills.length - 1] : null;
  const since =
    stats.streak > 0 ? (goal.mode === 'quit' ? t.sinceQuit(stats.streak, goal.name) : t.sinceReduce(stats.streak)) : goal.mode === 'quit' ? t.streakZero : t.streakZeroReduce;
  const label = tpl.timeBased ? t.timeBack : money ? t.saved : t.avoided;
  const nextText = ms.next ? t.nextMilestone(app.milestones.days(ms.next), ms.left) : t.allMilestones;
  const firstStart = goals.map((g) => dayKey(new Date(g.startAt))).sort()[0];
  const showBackup = !demo && backupDue(dayKey(now), { firstStart, lastBackup, snoozed: backupSnoozed });
  const install = demo ? null : installHint({ checkins: checkins.length, standalone: isStandalone(), seen: installSeen, ios: isIos(), canPrompt: !!promptInstall });
  const challengeDone = goal.challengeDays ? daysBetween(dayKey(new Date(goal.startAt)), today) : 0;

  const review = useMemo(
    () => (weeklyReview && isMonday(today) ? lastWeekReview(goals, events, workouts, now, sportGoal) : null),
    [weeklyReview, today, goals, events, workouts, now, sportGoal],
  );
  const showReview = review && review.perGoal.some((g) => g.of > 0) && reviewSeen !== review.week;
  const reviewText = review ? app.review.lines(review.perGoal.filter((g) => g.of > 0).map((g) => app.review.line(g.name, g.good, g.of, g.mode === 'reduce'))) : '';

  function openShare() {
    const c = shareContent({ goodDays: stats.goodDays, habit: goal.name, amount: stats.saved, showDays: true, showHabit: false, showAmount: false });
    const s = app.share;
    setShare({
      headline: s.headline,
      options: [
        { id: 'days', label: s.showDays, text: s.days(stats.goodDays), tone: 'primary', on: c.days !== null },
        { id: 'habit', label: s.showHabit, text: s.habit(goal.name), tone: 'ink', on: c.habit !== null },
        ...(money ? [{ id: 'amount', label: s.showAmount, text: s.amount(chf(stats.saved)), tone: 'gold' as const, on: c.amount !== null }] : []),
      ],
    });
  }

  const moodPicker = (
    <div className="grid3">
      {MOODS.map(([v, e]) => (
        <button
          key={v}
          className={`option mood ${todayCheck?.mood === v ? 'on' : ''}`}
          aria-pressed={todayCheck?.mood === v}
          onClick={() => {
            const first = !todayCheck;
            checkIn(v);
            setChanging(false);
            if (first) setStage(v === 1 ? 'ask' : 'journal');
          }}
        >
          <span style={{ fontSize: '1.625rem' }} aria-hidden="true">
            {e}
          </span>
          <span className="small">{t.moods[v]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {app.name}
        </div>
        <button className="btn sm ghost" onClick={openShare}>
          {app.share.open}
        </button>
      </div>
      {goals.length > 1 && (
        <div
          className="chips"
          role="tablist"
          aria-label={t.habits}
          onKeyDown={(e) => {
            // Pfeiltasten wechseln die Gewohnheit (roving tabindex), Pos1 und Ende springen an den Rand
            const i = goals.findIndex((g) => g.id === goal.id);
            const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: goals.length - 1 }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            const next = goals[(to + goals.length) % goals.length];
            setActive(next.id);
            requestAnimationFrame(() => document.getElementById(`habit-${next.id}`)?.focus());
          }}
        >
          {goals.map((g) => (
            <button
              key={g.id}
              id={`habit-${g.id}`}
              role="tab"
              aria-selected={g.id === goal.id}
              tabIndex={g.id === goal.id ? 0 : -1}
              className={`chip ${g.id === goal.id ? 'on' : ''}`}
              onClick={() => setActive(g.id)}
            >
              <span aria-hidden="true">{g.emoji}</span> {g.name}
            </button>
          ))}
        </div>
      )}

      {showReview && review && (
        <section className="card review" aria-labelledby="review-h">
          <h2 id="review-h" className="card-title">
            {app.review.title}
          </h2>
          <p className="strong">{reviewText}</p>
          <div className="grid2">
            {money && (
              <div className="stat">
                <span className="v num">{chf(review.saved, 0)}</span>
                <span className="l">
                  {app.common.chf} {app.review.saved}
                </span>
              </div>
            )}
            <div className="stat">
              <span className="v num">{review.trainingMinutes}</span>
              <span className="l">{app.sport.minutesUnit(review.trainingMinutes)}</span>
            </div>
          </div>
          <div className="row">
            <button
              className="btn sm primary"
              onClick={() =>
                setShare({
                  headline: app.share.reviewHeadline,
                  options: [
                    { id: 'days', label: app.share.showDays, text: reviewText, tone: 'primary', on: true },
                    { id: 'move', label: app.review.training, text: `${words.minutesLong(review.trainingMinutes)} ${app.review.training}`, tone: 'ink', on: review.trainingMinutes > 0 },
                    { id: 'amount', label: app.share.showAmount, text: app.share.amount(chf(review.saved)), tone: 'gold', on: false },
                  ],
                })
              }
            >
              {app.review.share}
            </button>
            <button className="btn sm ghost" onClick={() => markReviewSeen(review.week)}>
              {app.review.dismiss}
            </button>
          </div>
          <p className="tiny muted">{app.review.off}</p>
        </section>
      )}

      <section className="card hero-card tilt">
        <Ring progress={ms.progress} size={272} stroke={18} label={t.ringLabel} valueText={nextText}>
          <span className="eyebrow">
            <span className="pulse-dot" aria-hidden="true" /> {label}
          </span>
          <LiveSaved goal={goal} events={events} />
          <button className="since" aria-expanded={exact} onClick={() => setExact((v) => !v)}>
            {since}
          </button>
          {exact ? <LiveExact from={stats.cleanFrom} /> : <span className="tiny muted">{t.exactHint}</span>}
        </Ring>
        {goal.challengeDays && (
          <span className="pill gold">{challengeDone >= goal.challengeDays ? t.challengeDone : t.challenge(goal.challengeDays - challengeDone, goal.challengeDays)}</span>
        )}
        {goal.mode === 'reduce' && stats.plan && (
          <div className="counter">
            <p className="small strong">
              {stats.plan.extendedUntil ? t.planExtended(stats.plan.week, words.date(stats.plan.extendedUntil)) : t.planWeek(stats.plan.week, stats.plan.weeks, fmt(stats.plan.limit))}
            </p>
            <span className={`pill ${stats.todayUnits <= stats.todayLimit ? 'primary' : 'gold'}`}>{t.reduceToday(fmt(stats.todayUnits), fmt(stats.todayLimit))}</span>
            <div className="row">
              <button className="btn primary" style={{ flex: 1 }} onClick={() => addEvent({ goalId: goal.id, at: new Date().toISOString(), units: 1, kind: 'log' })}>
                {t.plusOne(goal.unitOne ?? goal.unit)}
              </button>
              <button className="btn ghost sm" aria-label={t.undoLast} disabled={stats.todayUnits === 0} onClick={() => undo(goal.id)}>
                {app.common.undo}
              </button>
            </div>
            <p className="small muted">{t.inPlan(stats.plan.inPlan, stats.plan.daysSoFar)}</p>
            {stats.todayUnits > stats.todayLimit && <p className="small muted">{t.overLimit}</p>}
          </div>
        )}
      </section>

      {/* Ein einziger nächster Schritt: einchecken, dann ein Satz fürs Tagebuch, danach der nächste Meilenstein */}
      {!todayCheck || changing ? (
        <section className="card" aria-labelledby="checkin-h">
          <h2 id="checkin-h" className="card-title">
            {changing ? t.checkinChangeLabel : t.checkinTitle}
          </h2>
          {moodPicker}
        </section>
      ) : stage === 'ask' ? (
        <section className="card" aria-labelledby="ask-h">
          <h2 id="ask-h" className="card-title">
            {t.toughAsk}
          </h2>
          <div className="row">
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                setStage('journal');
                setSheet('sos');
              }}
            >
              {t.toughYes}
            </button>
            <button className="btn ghost" onClick={() => setStage('journal')}>
              {t.toughNo}
            </button>
          </div>
        </section>
      ) : stage === 'journal' ? (
        <section className="card" aria-labelledby="journal-h">
          <h2 id="journal-h" className="card-title">
            {t.checkinThanks}
          </h2>
          <div className="field">
            <label htmlFor="journal">{t.journalLabel}</label>
            <textarea id="journal" className="input journal" maxLength={200} placeholder={t.journalPlaceholder} value={note} onChange={(e) => setNoteText(e.target.value)} />
          </div>
          <div className="row">
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                if (note.trim()) {
                  setNote(note);
                  setToast(t.journalSaved);
                }
                setStage(null);
              }}
            >
              {app.common.save}
            </button>
            <button className="btn quiet" onClick={() => setStage(null)}>
              {app.common.done}
            </button>
          </div>
        </section>
      ) : (
        <section className="card next" aria-label={t.ringLabel}>
          <div className="row between">
            <span className="eyebrow">
              {t.moods[todayCheck.mood]} · {t.checkinThanks}
            </span>
            <button className="btn sm quiet" aria-label={t.checkinChangeLabel} onClick={() => setChanging(true)}>
              {t.checkinChange}
            </button>
          </div>
          <p className="next-text">{nextText}</p>
        </section>
      )}

      {showBackup && (
        <section className="card flat" aria-labelledby="backup-h">
          <h2 id="backup-h" className="card-title">
            {t.backupTitle}
          </h2>
          <p className="small">{t.backupText}</p>
          <div className="row">
            <button className="btn sm ghost" onClick={() => go('profil')}>
              {t.backupGo}
            </button>
            <button className="btn sm quiet" onClick={snoozeBackup}>
              {t.later}
            </button>
          </div>
        </section>
      )}

      {install && (
        <section className="card flat" aria-labelledby="install-h">
          <h2 id="install-h" className="card-title">
            {t.installTitle}
          </h2>
          <p className="small">{install === 'ios' ? t.installIos : t.installText}</p>
          <div className="row">
            {install === 'button' && promptInstall && (
              <button
                className="btn sm ghost"
                onClick={() => {
                  void promptInstall().finally(dismissInstall);
                }}
              >
                {t.installButton}
              </button>
            )}
            <button className="btn sm quiet" onClick={dismissInstall}>
              {t.installLater}
            </button>
          </div>
        </section>
      )}

      <button className="sos-btn" onClick={() => setSheet('sos')}>
        <span className="sos-ico" aria-hidden="true">
          🌿
        </span>
        <span className="sos-txt">
          <strong>{t.sos}</strong>
          <span className="small">{t.sosHint}</span>
        </span>
      </button>

      <section className="card reveal" aria-labelledby="strip-h">
        <div className="row between wrap">
          <h2 id="strip-h" className="card-title">
            {t.strip}
          </h2>
          {!isDay1 && <span className="small muted">{t.stripSummary(stats.goodDays, stats.streak)}</span>}
        </div>
        <div className="daystrip" role="group" aria-label={t.stripSpeech(strip.filter((x) => x.win).length, strip.length)}>
          {Array.from({ length: 14 - strip.length }).map((_, i) => (
            <i key={`e${i}`} className="empty" aria-hidden="true" />
          ))}
          {strip.map((dd) => (
            <button
              key={dd.day}
              className={dd.today ? 'today' : dd.win ? 'win' : 'miss'}
              aria-label={t.dayLabel(words.date(dd.day), dd.today ? t.dayRunning : dd.win ? t.dayGood : t.dayMiss)}
              onClick={() => setDayEdit(dd.day)}
            />
          ))}
        </div>
        <p className="tiny muted">{isDay1 ? t.day1 : t.stripHint}</p>
      </section>

      {(pot || lastPot) && (
        <button className="pot-line reveal" onClick={() => go('ziele')}>
          <span aria-hidden="true">🎯</span>
          <span>{pot ? t.savingsLine(pot.pot.name, chf(pot.left)) : t.savingsDone(lastPot!.pot.name)}</span>
          <span className="muted" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      {goal.mode === 'quit' && (
        <button className="btn quiet slip-link" onClick={() => setSheet('slip')}>
          {t.slipLink}
        </button>
      )}

      {/* «Deine X guten Tage bleiben»: nur abgeschlossene Tage, heute läuft noch */}
      {sheet === 'slip' && (
        <SlipSheet goal={goal} goodDays={stats.goodDays - (stats.days[stats.days.length - 1]?.win ? 1 : 0)} onClose={() => setSheet(null)} onSaved={() => setToast(t.toastSaved)} />
      )}
      {sheet === 'sos' && (
        <SosSheet goal={goal} onClose={() => setSheet(null)} onSlip={goal.mode === 'quit' ? () => setSheet('slip') : undefined} onMoved={() => setToast(t.toastMoved)} />
      )}
      {dayEdit && (
        <DaySheet
          goal={goal}
          day={dayEdit}
          units={stats.days.find((x) => x.day === dayEdit)?.units ?? 0}
          onClose={() => setDayEdit(null)}
          onSaved={() => setToast(t.toastCorrected)}
        />
      )}
      {share && (
        <Suspense fallback={null}>
          <ShareSheet headline={share.headline} options={share.options} onClose={() => setShare(null)} onDone={setToast} />
        </Suspense>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
