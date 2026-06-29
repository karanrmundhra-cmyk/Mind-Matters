import type { Loop, TouchView, ContactView, GroupView, LoopOwnerView, RoutineView } from '@/domain/loop/types';
import type { LoopStatus, Priority, Channel, LoopSource } from '@/domain/enums';
import type { TransitionOptions } from '@/domain/loop/service';

/** Input to create a new (confirmed) loop. */
export interface NewLoopInput {
  spaceId: string;
  createdById: string;
  title: string;
  ask: string;
  definitionOfDone: string;
  deadline: Date | null;
  priority: Priority;
  channel: Channel | null;
  source: LoopSource;
  followupPolicyDays?: number | null;
  owners: Array<Pick<LoopOwnerView, 'contactId' | 'name'>>;
  status?: LoopStatus; // defaults to Confirmed on create
}

/** Partial field update (excludes status — status changes go through applyTransition). */
export interface LoopPatch {
  title?: string;
  ask?: string;
  definitionOfDone?: string;
  deadline?: Date | null;
  priority?: Priority;
  channel?: Channel | null;
  followupPolicyDays?: number | null;
}

export interface NewTouchInput {
  type: TouchView['type'];
  channel?: Channel | null;
  payload?: Record<string, unknown> | null;
}

/**
 * THE persistence contract for a workspace. The in-memory implementation (dev/test
 * scaffolding) and the Prisma/Supabase implementation both satisfy this exact interface
 * with no changes required elsewhere. Business logic lives above this boundary — the
 * repository only persists.
 */
export interface WorkspaceRepository {
  // Loops
  listLoops(spaceId: string): Promise<Loop[]>;
  getLoop(spaceId: string, id: string): Promise<Loop | null>;
  createLoop(input: NewLoopInput): Promise<Loop>;
  updateLoop(spaceId: string, id: string, patch: LoopPatch, expectedVersion: number): Promise<Loop>;
  reorderLoops(spaceId: string, orderedIds: string[]): Promise<void>;
  /** Atomic status transition (enforces the state machine via the shared planTransition). */
  applyTransition(spaceId: string, id: string, to: LoopStatus, opts?: TransitionOptions): Promise<Loop>;

  // Timeline
  listTouches(loopId: string): Promise<TouchView[]>;
  addTouch(loopId: string, touch: NewTouchInput): Promise<TouchView>;

  // Contacts & groups (for owner display, filters, quick-tabs)
  listContacts(spaceId: string): Promise<ContactView[]>;
  listGroups(spaceId: string): Promise<GroupView[]>;

  // Routines (daily habits with streaks; reset is computed from the local day, not stored)
  listRoutines(userId: string): Promise<RoutineView[]>;
  createRoutine(userId: string, title: string, timezone: string): Promise<RoutineView>;
  /** Toggle today's check for a routine, applying the streak rules. */
  checkRoutine(userId: string, routineId: string, now: Date): Promise<RoutineView>;
}
