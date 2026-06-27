import type { Priority } from '@/domain/enums';

/** Default follow-up cadence in days, keyed by priority. User can override per loop. */
export const FOLLOWUP_CADENCE_DAYS: Readonly<Record<Priority, number>> = {
  Critical: 1, // daily
  High: 2,
  Medium: 3,
  Low: 7, // weekly
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the next follow-up timestamp.
 * @param priority  loop priority (drives the default cadence)
 * @param from      the anchor time (last follow-up or waiting_since), defaults to now
 * @param overrideDays  explicit user override; when > 0 it wins over the default
 */
export function nextFollowupAt(
  priority: Priority,
  from: Date = new Date(),
  overrideDays?: number,
): Date {
  const days = overrideDays && overrideDays > 0 ? overrideDays : FOLLOWUP_CADENCE_DAYS[priority];
  return new Date(from.getTime() + days * DAY_MS);
}

/** Whether a follow-up is due at `now` given the scheduled next time. */
export function isFollowupDue(nextFollowupAt: Date | null, now: Date = new Date()): boolean {
  return nextFollowupAt !== null && nextFollowupAt.getTime() <= now.getTime();
}
