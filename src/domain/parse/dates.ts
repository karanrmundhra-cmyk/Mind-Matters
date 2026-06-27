/**
 * Deterministic relative-date extraction for the fast-path (no LLM).
 * Returns a Date or null — NEVER guesses a date that isn't expressed.
 *
 * NOTE: times are normalised to 18:00 UTC of the target day for determinism in the
 * MVP fast-path. Full local-timezone + DST handling is layered in Step 4 (reminders),
 * where deadlines are recomputed against the user's tz. Tracked in DECISIONS (D-006).
 */
const DAY_MS = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function atEodUtc(base: Date, addDays: number): Date {
  const d = new Date(base.getTime() + addDays * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18, 0, 0, 0));
}

export function parseRelativeDate(text: string, now: Date = new Date()): Date | null {
  const t = text.toLowerCase();

  if (/\b(day after tomorrow)\b/.test(t)) return atEodUtc(now, 2);
  if (/\btomorrow\b/.test(t)) return atEodUtc(now, 1);
  if (/\b(today|tonight|eod|end of day|by end of day)\b/.test(t)) return atEodUtc(now, 0);
  if (/\bnext week\b/.test(t)) return atEodUtc(now, 7);

  const inDays = t.match(/\bin (\d{1,3}) days?\b/);
  if (inDays) return atEodUtc(now, Number(inDays[1]));

  // "by friday" / "on monday" / bare weekday → the next occurrence of that weekday.
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i]!;
    if (new RegExp(`\\b(by |on |this |next )?${name}\\b`).test(t)) {
      const today = now.getUTCDay();
      let delta = (i - today + 7) % 7;
      if (delta === 0) delta = 7; // "friday" said on a Friday means the next Friday
      return atEodUtc(now, delta);
    }
  }

  return null;
}
