import { useEffect } from 'react';
import { useStore } from '../../app/store';
import { detectBadges, GLOBAL, type Celebration } from '../../domain/milestones';
import { app } from '../../i18n/de-CH';
import { spark } from '../../ui/motion';

export function celebrationText(c: Celebration): string {
  const t = app.milestones;
  if (c.kind === 'days') return t.text[c.n] ?? t.days(c.n);
  if (c.kind === 'money') return t.money(c.n);
  return t.craving;
}

export function badgeLabel(c: Celebration): string {
  const t = app.badges;
  if (c.kind === 'days') return t.days(c.n);
  if (c.kind === 'money') return t.money(c.n);
  return t.craving;
}

/** «Verlangen überstanden»: einmal feiern, dann merken. */
export function useBadgeCelebration(onCelebrate: (text: string) => void) {
  const cravings = useStore((s) => s.cravings.length);
  const seen = useStore((s) => s.seenMilestones[GLOBAL]);
  const markGlobal = useStore((s) => s.markGlobal);
  useEffect(() => {
    const r = detectBadges(cravings, seen ?? []);
    if (r.newKeys.length === 0) return;
    markGlobal(r.newKeys);
    if (r.celebrate) {
      onCelebrate(celebrationText(r.celebrate));
      setTimeout(() => spark(undefined, undefined, { count: 70 }), 120);
    }
    // onCelebrate wechselt bei jedem Rendern, entscheidend sind die Zahlen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cravings, seen, markGlobal]);
}
