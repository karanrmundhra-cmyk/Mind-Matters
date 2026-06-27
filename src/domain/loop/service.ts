import type { LoopStatus, Priority, TouchType } from '@/domain/enums';
import { assertTransition, isClosed } from '@/domain/loop/stateMachine';
import { nextFollowupAt } from '@/domain/loop/followup';

/** The minimal loop shape the transition planner needs (decoupled from Prisma). */
export interface TransitionableLoop {
  status: LoopStatus;
  priority: Priority;
  followupPolicyDays: number | null;
  waitingSince: Date | null;
}

export interface TransitionOptions {
  now?: Date;
  byUserId?: string;
  reason?: string;
}

/** Field updates to persist on the loop row. */
export interface LoopFieldUpdates {
  status: LoopStatus;
  waitingSince?: Date;
  nextFollowupAt?: Date | null;
  lastFollowupAt?: Date | null;
  completedAt?: Date;
  closedAt?: Date;
  archivedAt?: Date;
  deletedAt?: Date;
}

export interface TransitionRecord {
  fromStatus: LoopStatus;
  toStatus: LoopStatus;
  byUserId: string | null;
  reason: string | null;
}

export interface TouchRecord {
  type: TouchType;
  payload: Record<string, unknown>;
}

export interface TransitionPlan {
  updates: LoopFieldUpdates;
  transition: TransitionRecord;
  touch: TouchRecord;
}

/**
 * Pure transition planner — enforces the state machine and derives all the
 * timestamp side-effects of a status change, plus the audit/transition/touch
 * records. Throws `InvalidTransitionError` on an illegal move. No DB, no I/O,
 * fully unit-testable.
 */
export function planTransition(
  loop: TransitionableLoop,
  to: LoopStatus,
  opts: TransitionOptions = {},
): TransitionPlan {
  const from = loop.status;
  assertTransition(from, to);

  const now = opts.now ?? new Date();
  const updates: LoopFieldUpdates = { status: to };

  switch (to) {
    case 'Awaiting': {
      // Begin (or continue) waiting; schedule the next follow-up from the cadence.
      updates.waitingSince = loop.waitingSince ?? now;
      updates.nextFollowupAt = nextFollowupAt(loop.priority, now, loop.followupPolicyDays ?? undefined);
      break;
    }
    case 'Responded': {
      // Reply received — stop chasing until the user decides next step.
      updates.nextFollowupAt = null;
      break;
    }
    case 'Completed': {
      updates.completedAt = now;
      updates.nextFollowupAt = null;
      break;
    }
    case 'Closed': {
      updates.closedAt = now;
      updates.nextFollowupAt = null;
      break;
    }
    case 'Dropped': {
      updates.nextFollowupAt = null;
      break;
    }
    case 'Archived': {
      updates.archivedAt = now;
      break;
    }
    case 'Deleted': {
      updates.deletedAt = now;
      break;
    }
    default:
      break;
  }

  const touchType: TouchType = isClosed(to) ? 'closed' : 'status_changed';

  return {
    updates,
    transition: {
      fromStatus: from,
      toStatus: to,
      byUserId: opts.byUserId ?? null,
      reason: opts.reason ?? null,
    },
    touch: { type: touchType, payload: { from, to } },
  };
}
