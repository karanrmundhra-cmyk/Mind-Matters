import type { Loop } from '@/domain/loop/types';
import type { Channel, ReminderKind } from '@/domain/enums';
import { localDayDiff, localDateKey, nextLocalMidnightUtc, localParts } from '@/domain/time/tz';
import { nextFollowupAt } from '@/domain/loop/followup';
import { isDone } from '@/domain/loop/stateMachine';

export interface ReminderItem {
  loopId: string;
  loopTitle: string;
  kind: ReminderKind;
  dueAt: Date;
  channel: Channel | null;
}

export interface ReminderBuckets {
  overdue: ReminderItem[];
  today: ReminderItem[];
  upcoming: ReminderItem[];
}

/** Quiet-hours window in the user's local time (e.g. 22:00–07:00 → {start:22,end:7}). */
export interface QuietHours {
  startHour: number;
  endHour: number;
}

/** No reminders for loops that are done/closed/dropped (per spec). */
function remindable(loop: Loop): boolean {
  return !isDone(loop.status);
}

/**
 * Derive the reminder items implied by loops: a deadline reminder for each loop with a
 * deadline, and a follow-up reminder for each loop with a scheduled next follow-up.
 * Single source of truth — the Reminders screen renders these.
 */
export function deriveReminders(loops: Loop[]): ReminderItem[] {
  const items: ReminderItem[] = [];
  for (const loop of loops) {
    if (!remindable(loop)) continue;
    if (loop.deadline) {
      items.push({ loopId: loop.id, loopTitle: loop.title, kind: 'deadline', dueAt: loop.deadline, channel: null });
    }
    if (loop.nextFollowupAt) {
      items.push({
        loopId: loop.id,
        loopTitle: loop.title,
        kind: 'followup',
        dueAt: loop.nextFollowupAt,
        channel: loop.channel,
      });
    }
  }
  return items;
}

export interface DueFollowup {
  loopId: string;
  loopTitle: string;
  channel: Channel | null;
  dueAt: Date;
  /** When the follow-up should be rescheduled to after firing now (idempotent re-run). */
  rescheduleTo: Date;
}

/**
 * Background-job logic: which loops have a follow-up due at `now`. Pure + idempotent —
 * re-running yields the same set for the same inputs. The caller persists the reschedule
 * (`rescheduleTo`) and dispatches the reminder; nothing is sent here.
 */
export function dueFollowups(loops: Loop[], now: Date = new Date()): DueFollowup[] {
  const out: DueFollowup[] = [];
  for (const loop of loops) {
    if (!remindable(loop)) continue;
    if (loop.nextFollowupAt && loop.nextFollowupAt.getTime() <= now.getTime()) {
      out.push({
        loopId: loop.id,
        loopTitle: loop.title,
        channel: loop.channel,
        dueAt: loop.nextFollowupAt,
        rescheduleTo: nextFollowupAt(loop.priority, now, loop.followupPolicyDays ?? undefined),
      });
    }
  }
  return out;
}

/** Bucket reminders into Overdue / Today / Upcoming by the user's local calendar day. */
export function bucketReminders(items: ReminderItem[], now: Date, tz: string): ReminderBuckets {
  const buckets: ReminderBuckets = { overdue: [], today: [], upcoming: [] };
  for (const item of items) {
    const diff = localDayDiff(now, item.dueAt, tz);
    if (diff < 0) buckets.overdue.push(item);
    else if (diff === 0) buckets.today.push(item);
    else buckets.upcoming.push(item);
  }
  const byDue = (a: ReminderItem, b: ReminderItem) => a.dueAt.getTime() - b.dueAt.getTime();
  buckets.overdue.sort(byDue);
  buckets.today.sort(byDue);
  buckets.upcoming.sort(byDue);
  return buckets;
}

/** True if the local time at `instant` falls within the quiet-hours window. */
export function isWithinQuietHours(instant: Date, tz: string, quiet: QuietHours): boolean {
  const hour = localParts(instant, tz).hour;
  if (quiet.startHour === quiet.endHour) return false;
  if (quiet.startHour < quiet.endHour) {
    return hour >= quiet.startHour && hour < quiet.endHour;
  }
  // Overnight window (e.g. 22→7): inside if after start OR before end.
  return hour >= quiet.startHour || hour < quiet.endHour;
}

/**
 * The earliest instant a SELF-reminder may be delivered: now, unless we're inside quiet
 * hours, in which case it is held until the window opens (the next local `endHour`).
 */
export function nextDeliverableTime(now: Date, tz: string, quiet: QuietHours): Date {
  if (!isWithinQuietHours(now, tz, quiet)) return now;
  const p = localParts(now, tz);
  // If still before today's endHour (overnight tail), open today; else open tomorrow.
  const opensToday = p.hour < quiet.endHour;
  const base = opensToday ? startOfLocalDay(now, tz) : nextLocalMidnightUtc(now, tz);
  return new Date(base.getTime() + quiet.endHour * 60 * 60 * 1000);
}

function startOfLocalDay(now: Date, tz: string): Date {
  // local midnight today as UTC: next midnight minus a day
  return new Date(nextLocalMidnightUtc(now, tz).getTime() - 24 * 60 * 60 * 1000);
}

export type SnoozeOption = '15m' | '1h' | 'tomorrow';

/** Compute the new due time for a snoozed reminder. "tomorrow" = 9:00 local next day. */
export function snoozeUntil(now: Date, option: SnoozeOption, tz: string): Date {
  if (option === '15m') return new Date(now.getTime() + 15 * 60 * 1000);
  if (option === '1h') return new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(nextLocalMidnightUtc(now, tz).getTime() + 9 * 60 * 60 * 1000);
}

/**
 * Enforce: at most ONE reminder per loop + channel + local day. Keeps the earliest due
 * item in each (loop, channel, day) group. Idempotent.
 */
export function capPerLoopChannelDay(items: ReminderItem[], tz: string): ReminderItem[] {
  const seen = new Map<string, ReminderItem>();
  for (const item of items) {
    const key = `${item.loopId}|${item.channel ?? 'self'}|${localDateKey(item.dueAt, tz)}`;
    const existing = seen.get(key);
    if (!existing || item.dueAt.getTime() < existing.dueAt.getTime()) seen.set(key, item);
  }
  return [...seen.values()];
}
