import { localDayDiff } from '@/domain/time/tz';

/**
 * Routine streak logic. A routine is a daily habit that resets at local midnight.
 * Streak rules (computed in the user's timezone):
 *  - checking on consecutive local days increments the streak,
 *  - checking the same day again is a no-op,
 *  - a gap of more than one local day resets the streak to 1 on the next check.
 * Pure + timezone-aware; no I/O.
 */

export interface RoutineState {
  streakCount: number;
  lastCheckedOn: Date | null;
}

/** Whether the routine has already been checked on the current local day. */
export function isCheckedToday(state: RoutineState, now: Date, tz: string): boolean {
  return state.lastCheckedOn !== null && localDayDiff(state.lastCheckedOn, now, tz) === 0;
}

/**
 * Apply a check at `now`. Returns the new state. Idempotent within the same local day
 * (checking twice the same day doesn't change the streak).
 */
export function checkRoutine(state: RoutineState, now: Date, tz: string): RoutineState {
  if (state.lastCheckedOn === null) {
    return { streakCount: 1, lastCheckedOn: now };
  }
  const diff = localDayDiff(state.lastCheckedOn, now, tz);
  if (diff <= 0) return state; // already checked today (or clock skew) — no-op
  if (diff === 1) return { streakCount: state.streakCount + 1, lastCheckedOn: now };
  return { streakCount: 1, lastCheckedOn: now }; // missed one or more days → restart
}

/**
 * The streak to DISPLAY at `now`. The stored streak stays "alive" if the last check was
 * today or yesterday; if older, the streak is broken and shows 0 until the next check.
 */
export function displayStreak(state: RoutineState, now: Date, tz: string): number {
  if (state.lastCheckedOn === null) return 0;
  const diff = localDayDiff(state.lastCheckedOn, now, tz);
  return diff <= 1 ? state.streakCount : 0;
}
