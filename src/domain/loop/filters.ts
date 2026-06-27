import type { Loop } from '@/domain/loop/types';
import type { LoopStatus, Priority, Channel } from '@/domain/enums';

/** The four Loops segments. */
export type Segment = 'by_me' | 'to_me' | 'waiting' | 'watching';

export type DeadlineBucket = 'overdue' | 'today' | 'upcoming' | 'none';

/** Universal filter spec. All present dimensions combine with AND. */
export interface LoopFilter {
  ownerContactIds?: string[];
  statuses?: LoopStatus[];
  priorities?: Priority[];
  channels?: Channel[];
  groupId?: string;
  deadline?: DeadlineBucket;
}

const WAITING_STATUSES: ReadonlySet<LoopStatus> = new Set<LoopStatus>([
  'Scheduled',
  'Awaiting',
  'Blocked',
  'Escalated',
]);

/** Statuses hidden from the default lists (terminal / archived / soft-deleted). */
const HIDDEN_STATUSES: ReadonlySet<LoopStatus> = new Set<LoopStatus>(['Archived', 'Deleted']);

export function isActive(loop: Loop): boolean {
  return !HIDDEN_STATUSES.has(loop.status);
}

/** Which day-bucket a loop's deadline falls into, relative to `now` (local-naive for MVP). */
export function deadlineBucket(loop: Loop, now: Date = new Date()): DeadlineBucket {
  if (!loop.deadline) return 'none';
  const d = loop.deadline;
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) return 'today';
  return d.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}

/** Segment membership. In MVP (single owner-user) `to_me`/`watching` are typically empty. */
export function inSegment(loop: Loop, segment: Segment, userId: string): boolean {
  switch (segment) {
    case 'by_me':
      return loop.createdById === userId;
    case 'to_me':
      return loop.owners.some((o) => o.contactId === userId);
    case 'waiting':
      return WAITING_STATUSES.has(loop.status);
    case 'watching':
      return loop.createdById !== userId && !loop.owners.some((o) => o.contactId === userId);
  }
}

/** Apply the universal filter (AND across dimensions). Pure. */
export function applyFilters(loops: Loop[], filter: LoopFilter, now: Date = new Date()): Loop[] {
  return loops.filter((loop) => {
    if (filter.statuses?.length && !filter.statuses.includes(loop.status)) return false;
    if (filter.priorities?.length && !filter.priorities.includes(loop.priority)) return false;
    if (filter.channels?.length && (!loop.channel || !filter.channels.includes(loop.channel))) return false;
    if (filter.ownerContactIds?.length) {
      const owners = new Set(loop.owners.map((o) => o.contactId));
      if (!filter.ownerContactIds.some((id) => owners.has(id))) return false;
    }
    if (filter.deadline && deadlineBucket(loop, now) !== filter.deadline) return false;
    return true;
  });
}

/** Default manual ordering (drag-to-reorder persistence drives orderIndex). */
export function sortByOrder(loops: Loop[]): Loop[] {
  return [...loops].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Days a loop has been waiting, for the row's "days-waiting" chip. */
export function daysWaiting(loop: Loop, now: Date = new Date()): number {
  if (!loop.waitingSince) return 0;
  return Math.max(0, Math.floor((now.getTime() - loop.waitingSince.getTime()) / 86_400_000));
}

/** Compose segment + filters + ordering — the one place list semantics live. */
export function selectLoops(
  loops: Loop[],
  opts: { segment: Segment; userId: string; filter?: LoopFilter; now?: Date },
): Loop[] {
  const now = opts.now ?? new Date();
  const visible = loops.filter(
    (l) => isActive(l) && inSegment(l, opts.segment, opts.userId),
  );
  return sortByOrder(applyFilters(visible, opts.filter ?? {}, now));
}
