/** Pure month-grid builder for the Reminders calendar (Sunday-first, 6 weeks). */

export interface CalendarCell {
  dateKey: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
}

function key(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Build a 6×7 grid of cells for the given month (month is 1-12). Leading/trailing
 * cells come from the adjacent months and are flagged `inMonth: false`.
 */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const m0 = month - 1;
  const first = new Date(Date.UTC(year, m0, 1));
  const startDow = first.getUTCDay(); // 0=Sun
  const gridStart = new Date(Date.UTC(year, m0, 1 - startDow));

  const weeks: CalendarCell[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const y = cursor.getUTCFullYear();
      const mo = cursor.getUTCMonth();
      const day = cursor.getUTCDate();
      week.push({ dateKey: key(y, mo, day), day, inMonth: mo === m0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
