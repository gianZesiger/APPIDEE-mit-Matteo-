import { useStore } from '../../app/store';
import { canExtend, planStages, stageOn } from '../../domain/reduction';
import { addDays, dayKey } from '../../domain/time';
import { rateOn, startDayOf } from '../../domain/rates';
import type { Goal } from '../../domain/types';
import { app, words } from '../../i18n/de-CH';

const t = app.ziele;
const fmt = (v: number) => (v % 1 ? v.toFixed(1) : String(v));

/** Der Reduktionsplan mit «Stufe verlängern» (höchstens einmal pro Woche, nie rückwärts). */
export function ReducePlan({ goal }: { goal: Goal }) {
  const extend = useStore((s) => s.extendStage);
  const today = dayKey(new Date());
  const stages = planStages(goal);
  const now = stageOn(goal, today);
  const last = [...(goal.planExtensions ?? [])].sort().pop();
  const can = canExtend(goal, today);
  return (
    <div className="card flat" style={{ gap: 6 }}>
      <span className="eyebrow">{t.plan}</span>
      <p className="small">{t.planText(fmt(rateOn(goal, startDayOf(goal)).perDay), stages.map((s) => t.planStep(s.index + 1, fmt(s.limit))))}</p>
      <p className="small" style={{ fontWeight: 700 }}>
        {t.planNow(now.index + 1)}
        {now.extended && now.end ? ` ${t.extendDone(words.date(addDays(now.end, -1)))}` : ''}
      </p>
      <button className="linkbtn" style={{ alignSelf: 'flex-start' }} disabled={!can} onClick={() => extend(goal.id)}>
        {t.extend}
      </button>
      {['snus', 'vape', 'zig', 'kaffee'].includes(goal.templateKey) && <span className="tiny muted">{app.onboarding.reduceHint}</span>}
      <span className="tiny muted">{can ? t.extendHint : now.end === null ? t.extendLast : last ? t.extendWait(words.date(addDays(last, 7))) : t.extendHint}</span>
    </div>
  );
}
