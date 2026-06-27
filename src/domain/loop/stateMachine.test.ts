import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  nextStatuses,
  isClosed,
  isTerminal,
  pathToClosed,
  canQuickClose,
  InvalidTransitionError,
  LOOP_TRANSITIONS,
} from '@/domain/loop/stateMachine';
import { LOOP_STATUSES, type LoopStatus } from '@/domain/enums';

describe('loop state machine', () => {
  it('allows the canonical happy path', () => {
    const path: LoopStatus[] = [
      'Draft',
      'Confirmed',
      'Scheduled',
      'Awaiting',
      'Responded',
      'Completed',
      'Closed',
      'Archived',
      'Deleted',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('allows Awaiting → Blocked/Escalated and back to Responded or Dropped', () => {
    expect(canTransition('Awaiting', 'Blocked')).toBe(true);
    expect(canTransition('Awaiting', 'Escalated')).toBe(true);
    expect(canTransition('Blocked', 'Responded')).toBe(true);
    expect(canTransition('Blocked', 'Dropped')).toBe(true);
    expect(canTransition('Escalated', 'Responded')).toBe(true);
    expect(canTransition('Escalated', 'Dropped')).toBe(true);
  });

  it('lets any non-terminal status be Dropped', () => {
    const droppable: LoopStatus[] = [
      'Draft',
      'Confirmed',
      'Scheduled',
      'Awaiting',
      'Responded',
      'Blocked',
      'Escalated',
      'Completed',
    ];
    for (const s of droppable) expect(canTransition(s, 'Dropped')).toBe(true);
  });

  it('forbids skipping states', () => {
    expect(canTransition('Draft', 'Awaiting')).toBe(false);
    expect(canTransition('Confirmed', 'Responded')).toBe(false);
    expect(canTransition('Scheduled', 'Completed')).toBe(false);
    expect(canTransition('Awaiting', 'Closed')).toBe(false);
  });

  it('forbids self-transition and reviving terminal Deleted', () => {
    expect(() => assertTransition('Awaiting', 'Awaiting')).toThrow(InvalidTransitionError);
    expect(nextStatuses('Deleted')).toHaveLength(0);
    expect(isTerminal('Deleted')).toBe(true);
  });

  it('throws InvalidTransitionError with from/to on illegal moves', () => {
    try {
      assertTransition('Draft', 'Closed');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      const err = e as InvalidTransitionError;
      expect(err.from).toBe('Draft');
      expect(err.to).toBe('Closed');
    }
  });

  it('marks Completed and Closed as closed for WCL', () => {
    expect(isClosed('Completed')).toBe(true);
    expect(isClosed('Closed')).toBe(true);
    expect(isClosed('Awaiting')).toBe(false);
  });

  it('pathToClosed only ever yields legal step-by-step transitions', () => {
    const from: LoopStatus[] = ['Awaiting', 'Blocked', 'Escalated', 'Responded', 'Completed'];
    for (const start of from) {
      const path = pathToClosed(start);
      expect(path).not.toBeNull();
      let cursor = start;
      for (const next of path!) {
        expect(canTransition(cursor, next)).toBe(true);
        cursor = next;
      }
      expect(cursor).toBe('Closed');
    }
  });

  it('cannot quick-close from Draft/Confirmed/Scheduled', () => {
    for (const s of ['Draft', 'Confirmed', 'Scheduled'] as LoopStatus[]) {
      expect(pathToClosed(s)).toBeNull();
      expect(canQuickClose(s)).toBe(false);
    }
  });

  it('has a transition entry for every status (no undefined targets)', () => {
    for (const s of LOOP_STATUSES) {
      expect(LOOP_TRANSITIONS[s]).toBeDefined();
      for (const t of LOOP_TRANSITIONS[s]) expect(LOOP_STATUSES).toContain(t);
    }
  });
});
