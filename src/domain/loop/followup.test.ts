import { describe, it, expect } from 'vitest';
import { nextFollowupAt, isFollowupDue, FOLLOWUP_CADENCE_DAYS } from '@/domain/loop/followup';

const NOW = new Date('2026-06-28T10:00:00.000Z');

describe('follow-up cadence', () => {
  it('uses priority defaults: Critical=1d, High=2d, Medium=3d, Low=7d', () => {
    expect(FOLLOWUP_CADENCE_DAYS).toEqual({ Critical: 1, High: 2, Medium: 3, Low: 7 });
    expect(nextFollowupAt('Critical', NOW)).toEqual(new Date('2026-06-29T10:00:00.000Z'));
    expect(nextFollowupAt('Low', NOW)).toEqual(new Date('2026-07-05T10:00:00.000Z'));
  });

  it('lets a positive override win over the default', () => {
    expect(nextFollowupAt('Critical', NOW, 4)).toEqual(new Date('2026-07-02T10:00:00.000Z'));
  });

  it('ignores a zero/negative override', () => {
    expect(nextFollowupAt('Medium', NOW, 0)).toEqual(new Date('2026-07-01T10:00:00.000Z'));
  });

  it('detects due / not-due / never', () => {
    expect(isFollowupDue(new Date('2026-06-28T09:59:00.000Z'), NOW)).toBe(true);
    expect(isFollowupDue(new Date('2026-06-28T10:01:00.000Z'), NOW)).toBe(false);
    expect(isFollowupDue(null, NOW)).toBe(false);
  });
});
