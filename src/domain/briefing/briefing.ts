import type { Loop } from '@/domain/loop/types';
import type { LoopStatus } from '@/domain/enums';
import { daysWaiting } from '@/domain/loop/filters';
import { localDayDiff } from '@/domain/time/tz';
import { isClosed, isDone } from '@/domain/loop/stateMachine';

export interface BriefItem {
  loopId: string;
  title: string;
  reason: string;
}

export interface Briefing {
  /** Weekly Closed Loops — the North Star metric (closed in the last 7 days). */
  wcl: number;
  needsYouToday: BriefItem[];
  waitingOnOthers: BriefItem[];
  suggestedEscalations: BriefItem[];
}

const WAITING: ReadonlySet<LoopStatus> = new Set<LoopStatus>(['Awaiting', 'Scheduled', 'Blocked', 'Escalated']);

/** Loops closed (Completed/Closed) within the last 7×24h. */
export function weeklyClosedLoops(loops: Loop[], now: Date = new Date()): number {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return loops.filter((l) => {
    if (!isClosed(l.status)) return false;
    const at = (l.closedAt ?? l.completedAt)?.getTime();
    return at !== undefined && at >= weekAgo && at <= now.getTime();
  }).length;
}

/**
 * Build the daily briefing: what needs the user today, what they're waiting on, and
 * which loops to escalate. Deterministic + timezone-aware (AI phrasing can layer on top).
 */
export function buildBriefing(loops: Loop[], now: Date, tz: string): Briefing {
  const needsYouToday: BriefItem[] = [];
  const waitingOnOthers: BriefItem[] = [];
  const suggestedEscalations: BriefItem[] = [];

  for (const loop of loops) {
    if (isDone(loop.status)) continue;

    const deadlineDiff = loop.deadline ? localDayDiff(now, loop.deadline, tz) : null;
    const overdue = deadlineDiff !== null && deadlineDiff < 0;
    const dueToday = deadlineDiff === 0;
    const waited = daysWaiting(loop, now);

    if (overdue) needsYouToday.push({ loopId: loop.id, title: loop.title, reason: `${Math.abs(deadlineDiff!)}d overdue` });
    else if (dueToday) needsYouToday.push({ loopId: loop.id, title: loop.title, reason: 'Due today' });

    if (WAITING.has(loop.status)) {
      waitingOnOthers.push({ loopId: loop.id, title: loop.title, reason: waited > 0 ? `${waited}d waiting` : 'Awaiting' });
    }

    // Escalate: blocked/escalated, or waiting a long time, or overdue + critical.
    if (loop.status === 'Blocked' || loop.status === 'Escalated') {
      suggestedEscalations.push({ loopId: loop.id, title: loop.title, reason: loop.status });
    } else if (WAITING.has(loop.status) && waited >= 4) {
      suggestedEscalations.push({ loopId: loop.id, title: loop.title, reason: `Ignored ${waited}d` });
    } else if (overdue && loop.priority === 'Critical') {
      suggestedEscalations.push({ loopId: loop.id, title: loop.title, reason: 'Critical & overdue' });
    }
  }

  return { wcl: weeklyClosedLoops(loops, now), needsYouToday, waitingOnOthers, suggestedEscalations };
}
