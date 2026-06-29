import { describe, it, expect } from 'vitest';
import { checkRoutine, isCheckedToday, displayStreak, type RoutineState } from '@/domain/routines/streak';

const IST = 'Asia/Kolkata';
// All "days" below are local IST days; 10:00Z = 15:30 IST.
const day = (d: string) => new Date(`2026-06-${d}T10:00:00.000Z`);

describe('routine streak (local-midnight reset)', () => {
  it('first check starts a streak of 1', () => {
    const s = checkRoutine({ streakCount: 0, lastCheckedOn: null }, day('28'), IST);
    expect(s.streakCount).toBe(1);
  });

  it('checking the next local day increments the streak', () => {
    const s1 = checkRoutine({ streakCount: 3, lastCheckedOn: day('27') }, day('28'), IST);
    expect(s1.streakCount).toBe(4);
  });

  it('checking the same day again is a no-op', () => {
    const state: RoutineState = { streakCount: 5, lastCheckedOn: day('28') };
    expect(checkRoutine(state, new Date('2026-06-28T18:00:00Z'), IST).streakCount).toBe(5);
    expect(isCheckedToday(state, day('28'), IST)).toBe(true);
  });

  it('missing a day resets the streak to 1', () => {
    const s = checkRoutine({ streakCount: 9, lastCheckedOn: day('26') }, day('28'), IST);
    expect(s.streakCount).toBe(1);
  });

  it('display streak stays alive if checked today or yesterday, else 0', () => {
    expect(displayStreak({ streakCount: 4, lastCheckedOn: day('28') }, day('28'), IST)).toBe(4);
    expect(displayStreak({ streakCount: 4, lastCheckedOn: day('27') }, day('28'), IST)).toBe(4);
    expect(displayStreak({ streakCount: 4, lastCheckedOn: day('26') }, day('28'), IST)).toBe(0);
    expect(displayStreak({ streakCount: 0, lastCheckedOn: null }, day('28'), IST)).toBe(0);
  });
});
