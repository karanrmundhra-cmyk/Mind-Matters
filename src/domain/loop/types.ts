import type { LoopStatus, Priority, Channel, LoopSource, TouchType } from '@/domain/enums';

/** Per-owner view on a loop (a loop may have several owners, each with a sub-status). */
export interface LoopOwnerView {
  contactId: string;
  name: string;
  subStatus: LoopStatus;
  respondedAt: Date | null;
}

/**
 * The Loop domain entity the app + UI consume. Decoupled from the Prisma row so the
 * persistence layer can change without touching business logic or the UI.
 */
export interface Loop {
  id: string;
  spaceId: string;
  title: string;
  ask: string;
  definitionOfDone: string;
  deadline: Date | null;
  priority: Priority;
  status: LoopStatus;
  channel: Channel | null;
  source: LoopSource;
  orderIndex: number;
  followupPolicyDays: number | null;
  owners: LoopOwnerView[];
  createdById: string;
  createdAt: Date;
  waitingSince: Date | null;
  lastFollowupAt: Date | null;
  nextFollowupAt: Date | null;
  completedAt: Date | null;
  closedAt: Date | null;
  version: number;
}

/** A timeline event on a loop's communication history. */
export interface TouchView {
  id: string;
  loopId: string;
  type: TouchType;
  channel: Channel | null;
  timestamp: Date;
  payload?: Record<string, unknown> | null;
}

export interface ContactView {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  telephone: string | null;
  groupId: string | null;
}

export interface GroupView {
  id: string;
  name: string;
}
