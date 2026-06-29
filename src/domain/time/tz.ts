/**
 * Timezone helpers. Rule: store all timestamps in UTC, compute/display in the user's
 * IANA timezone. Uses the built-in Intl database — no external dependency. Handles DST
 * by recomputing the offset at the relevant instant.
 */

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function localParts(instant: Date, tz: string): LocalParts {
  const parts = formatter(tz).formatToParts(instant);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour: Number(m.hour),
    minute: Number(m.minute),
    second: Number(m.second),
  };
}

/** Local calendar day as 'YYYY-MM-DD' in the given tz. */
export function localDateKey(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** Offset (ms) such that wallclock = instant + offset, computed at `instant` (DST-aware). */
function offsetMs(instant: Date, tz: string): number {
  const p = localParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/** The UTC instant of local midnight (00:00) on the local day containing `instant`. */
export function startOfLocalDayUtc(instant: Date, tz: string): Date {
  const p = localParts(instant, tz);
  const wallMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  // Subtract the offset (approximated at this instant) to get the real UTC instant.
  return new Date(wallMidnightAsUtc - offsetMs(instant, tz));
}

/** The UTC instant of the next local midnight after `instant` (for routine resets). */
export function nextLocalMidnightUtc(instant: Date, tz: string): Date {
  const start = startOfLocalDayUtc(instant, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function isSameLocalDay(a: Date, b: Date, tz: string): boolean {
  return localDateKey(a, tz) === localDateKey(b, tz);
}

/** Whole local days from `from` to `to` (to - from), by local date key. */
export function localDayDiff(from: Date, to: Date, tz: string): number {
  const a = startOfLocalDayUtc(from, tz).getTime();
  const b = startOfLocalDayUtc(to, tz).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
