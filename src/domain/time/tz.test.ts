import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  startOfLocalDayUtc,
  nextLocalMidnightUtc,
  isSameLocalDay,
  localDayDiff,
} from '@/domain/time/tz';

const IST = 'Asia/Kolkata'; // UTC+5:30, no DST
const NY = 'America/New_York'; // UTC-4 in June (EDT)

describe('timezone helpers', () => {
  it('computes the local date key across the UTC day boundary (IST)', () => {
    // 20:00 UTC is 01:30 next day in IST
    expect(localDateKey(new Date('2026-06-28T20:00:00Z'), IST)).toBe('2026-06-29');
    expect(localDateKey(new Date('2026-06-28T10:00:00Z'), IST)).toBe('2026-06-28');
  });

  it('computes the local date key for a negative offset (New York)', () => {
    // 02:00 UTC is 22:00 previous day in EDT
    expect(localDateKey(new Date('2026-06-28T02:00:00Z'), NY)).toBe('2026-06-27');
  });

  it('returns local midnight as a UTC instant (IST = previous 18:30Z)', () => {
    expect(startOfLocalDayUtc(new Date('2026-06-29T01:30:00Z'), IST).toISOString()).toBe(
      '2026-06-28T18:30:00.000Z',
    );
  });

  it('returns local midnight as a UTC instant (EDT = 04:00Z)', () => {
    expect(startOfLocalDayUtc(new Date('2026-06-27T22:00:00Z'), NY).toISOString()).toBe(
      '2026-06-27T04:00:00.000Z',
    );
  });

  it('computes the next local midnight (routine reset point)', () => {
    expect(nextLocalMidnightUtc(new Date('2026-06-28T10:00:00Z'), IST).toISOString()).toBe(
      '2026-06-28T18:30:00.000Z',
    );
  });

  it('same-local-day + local day diff', () => {
    expect(isSameLocalDay(new Date('2026-06-28T01:00:00Z'), new Date('2026-06-28T18:00:00Z'), IST)).toBe(true);
    // 20:00Z 28th and 20:00Z 30th → 2 local days apart in IST
    expect(localDayDiff(new Date('2026-06-28T20:00:00Z'), new Date('2026-06-30T20:00:00Z'), IST)).toBe(2);
  });
});
