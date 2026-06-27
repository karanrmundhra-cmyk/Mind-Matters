import type { LoopStatus } from '@/domain/enums';

/**
 * Loop status machine — enforced in the service layer, NOT just the UI.
 *
 * Draft → Confirmed → Scheduled → Awaiting → Responded → Completed → Closed
 * Awaiting → Blocked | Escalated → (Responded | Dropped)
 * any non-terminal → Dropped
 * Closed | Dropped → Archived → Deleted (soft)
 *
 * No skipping states. Every transition must be audit-logged by the caller.
 */
export const LOOP_TRANSITIONS: Readonly<Record<LoopStatus, readonly LoopStatus[]>> = {
  Draft: ['Confirmed', 'Dropped'],
  Confirmed: ['Scheduled', 'Dropped'],
  Scheduled: ['Awaiting', 'Dropped'],
  Awaiting: ['Responded', 'Blocked', 'Escalated', 'Dropped'],
  Responded: ['Completed', 'Dropped'],
  Blocked: ['Responded', 'Dropped'],
  Escalated: ['Responded', 'Dropped'],
  Completed: ['Closed', 'Dropped'],
  Closed: ['Archived'],
  Dropped: ['Archived'],
  Archived: ['Deleted'],
  Deleted: [],
} as const;

/** Terminal statuses cannot transition anywhere (except the archival chain handled above). */
export const TERMINAL_STATUSES: readonly LoopStatus[] = ['Deleted'];

/** Statuses that represent a successfully closed loop (count toward Weekly Closed Loops). */
export const CLOSED_STATUSES: readonly LoopStatus[] = ['Completed', 'Closed'];

export class InvalidTransitionError extends Error {
  readonly from: LoopStatus;
  readonly to: LoopStatus;
  constructor(from: LoopStatus, to: LoopStatus) {
    super(`Illegal loop transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** True if `to` is a legal next status from `from`. */
export function canTransition(from: LoopStatus, to: LoopStatus): boolean {
  return LOOP_TRANSITIONS[from].includes(to);
}

/** The set of legal next statuses from `from` (e.g. to render available actions). */
export function nextStatuses(from: LoopStatus): readonly LoopStatus[] {
  return LOOP_TRANSITIONS[from];
}

/** Throws `InvalidTransitionError` unless the transition is legal. Use at the service boundary. */
export function assertTransition(from: LoopStatus, to: LoopStatus): void {
  if (from === to) throw new InvalidTransitionError(from, to);
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isClosed(status: LoopStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/**
 * The legal sequence of transitions that takes a loop to `Closed` from `from`
 * (used by tick-to-close). Returns null when the loop can't be quick-closed from
 * its current state (e.g. Draft/Confirmed/Scheduled must first reach Awaiting).
 * Every step is a legal transition and is individually audit-logged when applied —
 * states are advanced, never skipped.
 */
export function pathToClosed(from: LoopStatus): LoopStatus[] | null {
  switch (from) {
    case 'Awaiting':
    case 'Blocked':
    case 'Escalated':
      return ['Responded', 'Completed', 'Closed'];
    case 'Responded':
      return ['Completed', 'Closed'];
    case 'Completed':
      return ['Closed'];
    default:
      return null;
  }
}

export function canQuickClose(from: LoopStatus): boolean {
  return pathToClosed(from) !== null;
}

export function isTerminal(status: LoopStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
