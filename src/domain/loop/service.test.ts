import { describe, it, expect } from 'vitest';
import { planTransition, type TransitionableLoop } from '@/domain/loop/service';
import { InvalidTransitionError } from '@/domain/loop/stateMachine';

const base: TransitionableLoop = {
  status: 'Scheduled',
  priority: 'High',
  followupPolicyDays: null,
  waitingSince: null,
};

const NOW = new Date('2026-06-28T10:00:00.000Z');

describe('planTransition', () => {
  it('sets waitingSince and schedules next follow-up when entering Awaiting', () => {
    const plan = planTransition(base, 'Awaiting', { now: NOW });
    expect(plan.updates.status).toBe('Awaiting');
    expect(plan.updates.waitingSince).toEqual(NOW);
    // High priority default cadence = 2 days
    expect(plan.updates.nextFollowupAt).toEqual(new Date('2026-06-30T10:00:00.000Z'));
  });

  it('honours a per-loop follow-up override', () => {
    const plan = planTransition({ ...base, followupPolicyDays: 5 }, 'Awaiting', { now: NOW });
    expect(plan.updates.nextFollowupAt).toEqual(new Date('2026-07-03T10:00:00.000Z'));
  });

  it('preserves an existing waitingSince', () => {
    const earlier = new Date('2026-06-20T10:00:00.000Z');
    const plan = planTransition(
      { ...base, status: 'Blocked', waitingSince: earlier },
      'Responded',
      { now: NOW },
    );
    expect(plan.updates.nextFollowupAt).toBeNull();
  });

  it('stamps completedAt / closedAt and clears follow-up on completion/close', () => {
    const completed = planTransition({ ...base, status: 'Responded' }, 'Completed', { now: NOW });
    expect(completed.updates.completedAt).toEqual(NOW);
    expect(completed.updates.nextFollowupAt).toBeNull();
    expect(completed.touch.type).toBe('closed');

    const closed = planTransition({ ...base, status: 'Completed' }, 'Closed', { now: NOW });
    expect(closed.updates.closedAt).toEqual(NOW);
    expect(closed.touch.type).toBe('closed');
  });

  it('records the transition and a status_changed touch for non-closing moves', () => {
    const plan = planTransition({ ...base, status: 'Draft' }, 'Confirmed', {
      now: NOW,
      byUserId: 'u1',
      reason: 'user confirmed',
    });
    expect(plan.transition).toEqual({
      fromStatus: 'Draft',
      toStatus: 'Confirmed',
      byUserId: 'u1',
      reason: 'user confirmed',
    });
    expect(plan.touch.type).toBe('status_changed');
  });

  it('throws on an illegal transition', () => {
    expect(() => planTransition({ ...base, status: 'Draft' }, 'Closed', { now: NOW })).toThrow(
      InvalidTransitionError,
    );
  });
});
