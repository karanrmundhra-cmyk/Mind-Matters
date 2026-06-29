import { describe, it, expect } from 'vitest';
import {
  canCreateLoop,
  canCreateRoutine,
  remainingLoops,
  PLAN_PRICING,
  PLAN_LIMITS,
} from '@/domain/billing/plans';

describe('plan limits', () => {
  it('free caps active loops at 10 and routines at 1', () => {
    expect(canCreateLoop('free', 9)).toBe(true);
    expect(canCreateLoop('free', 10)).toBe(false);
    expect(canCreateRoutine('free', 0)).toBe(true);
    expect(canCreateRoutine('free', 1)).toBe(false);
  });

  it('pro and business are unlimited', () => {
    expect(canCreateLoop('pro', 9999)).toBe(true);
    expect(canCreateRoutine('business', 9999)).toBe(true);
    expect(remainingLoops('pro', 500)).toBe('unlimited');
  });

  it('remainingLoops counts down on free', () => {
    expect(remainingLoops('free', 3)).toBe(7);
    expect(remainingLoops('free', 12)).toBe(0);
  });

  it('annual pricing = 2 months free (×10 monthly)', () => {
    expect(PLAN_PRICING.pro.annual).toBe(PLAN_PRICING.pro.monthly * 10);
    expect(PLAN_PRICING.business.annual).toBe(PLAN_PRICING.business.monthly * 10);
  });

  it('free still allows email assisted-send + self-reminders', () => {
    expect(PLAN_LIMITS.free.assistedSend).toBe(true);
    expect(PLAN_LIMITS.free.whatsappSelfReminders).toBe(false);
  });
});
