import { prisma } from '@/lib/db';
import type {
  WorkspaceRepository,
  NewLoopInput,
  LoopPatch,
  NewTouchInput,
} from '@/domain/loop/repository';
import type { Loop, TouchView, ContactView, GroupView, RoutineView } from '@/domain/loop/types';
import type { LoopStatus, Priority, Channel, LoopSource } from '@/domain/enums';
import type { TransitionOptions } from '@/domain/loop/service';
import { checkRoutine as applyCheck } from '@/domain/routines/streak';
import { LoopNotFoundError, OptimisticLockError } from '@/domain/errors';
import { transitionLoop } from '@/server/loops/transition';

/** The raw Prisma loop row (with owners + contact name) that we map into the domain Loop. */
interface LoopRow {
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
  createdById: string;
  createdAt: Date;
  waitingSince: Date | null;
  lastFollowupAt: Date | null;
  nextFollowupAt: Date | null;
  completedAt: Date | null;
  closedAt: Date | null;
  version: number;
  owners: Array<{ contactId: string; subStatus: LoopStatus; respondedAt: Date | null; contact: { name: string } }>;
}

const LOOP_INCLUDE = { owners: { include: { contact: { select: { name: true } } } } } as const;

function mapLoop(row: LoopRow): Loop {
  return {
    id: row.id,
    spaceId: row.spaceId,
    title: row.title,
    ask: row.ask,
    definitionOfDone: row.definitionOfDone,
    deadline: row.deadline,
    priority: row.priority,
    status: row.status,
    channel: row.channel,
    source: row.source,
    orderIndex: row.orderIndex,
    followupPolicyDays: row.followupPolicyDays,
    owners: row.owners.map((o) => ({
      contactId: o.contactId,
      name: o.contact.name,
      subStatus: o.subStatus,
      respondedAt: o.respondedAt,
    })),
    createdById: row.createdById,
    createdAt: row.createdAt,
    waitingSince: row.waitingSince,
    lastFollowupAt: row.lastFollowupAt,
    nextFollowupAt: row.nextFollowupAt,
    completedAt: row.completedAt,
    closedAt: row.closedAt,
    version: row.version,
  };
}

/**
 * Prisma/Supabase implementation of WorkspaceRepository — the production persistence
 * layer. Implements the EXACT interface the in-memory repo does, so the rest of the app
 * is unchanged. Transitions reuse the shared `planTransition` (via `transitionLoop`).
 * Activated by `getRepository()` whenever DATABASE_URL is set.
 */
export class PrismaWorkspaceRepository implements WorkspaceRepository {
  async listLoops(spaceId: string): Promise<Loop[]> {
    const rows = await prisma.loop.findMany({
      where: { spaceId, deletedAt: null },
      include: LOOP_INCLUDE,
      orderBy: { orderIndex: 'asc' },
    });
    return rows.map((r: LoopRow) => mapLoop(r));
  }

  async getLoop(spaceId: string, id: string): Promise<Loop | null> {
    const row = await prisma.loop.findFirst({ where: { id, spaceId }, include: LOOP_INCLUDE });
    return row ? mapLoop(row as LoopRow) : null;
  }

  async createLoop(input: NewLoopInput): Promise<Loop> {
    const max = await prisma.loop.aggregate({
      where: { spaceId: input.spaceId },
      _max: { orderIndex: true },
    });
    const row = await prisma.loop.create({
      data: {
        spaceId: input.spaceId,
        createdById: input.createdById,
        title: input.title,
        ask: input.ask,
        definitionOfDone: input.definitionOfDone,
        deadline: input.deadline,
        priority: input.priority,
        status: input.status ?? 'Confirmed',
        channel: input.channel,
        source: input.source,
        followupPolicyDays: input.followupPolicyDays ?? null,
        orderIndex: (max._max.orderIndex ?? -1) + 1,
        owners: { create: input.owners.map((o) => ({ contactId: o.contactId, subStatus: 'Awaiting' as LoopStatus })) },
        touches: { create: [{ type: 'created' }] },
      },
      include: LOOP_INCLUDE,
    });
    return mapLoop(row as LoopRow);
  }

  async updateLoop(spaceId: string, id: string, patch: LoopPatch, expectedVersion: number): Promise<Loop> {
    const res = await prisma.loop.updateMany({
      where: { id, spaceId, version: expectedVersion },
      data: { ...patch, version: { increment: 1 } },
    });
    if (res.count === 0) {
      const exists = await prisma.loop.findFirst({ where: { id, spaceId }, select: { id: true } });
      throw exists ? new OptimisticLockError(id) : new LoopNotFoundError(id);
    }
    const updated = await this.getLoop(spaceId, id);
    if (!updated) throw new LoopNotFoundError(id);
    return updated;
  }

  async reorderLoops(spaceId: string, orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.loop.updateMany({ where: { id, spaceId }, data: { orderIndex: index } }),
      ),
    );
  }

  async applyTransition(spaceId: string, id: string, to: LoopStatus, opts: TransitionOptions = {}): Promise<Loop> {
    await transitionLoop(id, spaceId, to, opts); // shared planTransition + atomic write
    const loop = await this.getLoop(spaceId, id);
    if (!loop) throw new LoopNotFoundError(id);
    return loop;
  }

  async listTouches(loopId: string): Promise<TouchView[]> {
    const rows = await prisma.touch.findMany({ where: { loopId }, orderBy: { timestamp: 'asc' } });
    return rows.map((t: TouchView & { payload: unknown }) => ({
      id: t.id,
      loopId: t.loopId,
      type: t.type,
      channel: t.channel,
      timestamp: t.timestamp,
      payload: (t.payload as Record<string, unknown> | null) ?? null,
    }));
  }

  async addTouch(loopId: string, touch: NewTouchInput): Promise<TouchView> {
    const t = await prisma.touch.create({
      data: {
        loopId,
        type: touch.type,
        channel: touch.channel ?? null,
        payload: (touch.payload ?? undefined) as object | undefined,
      },
    });
    return {
      id: t.id,
      loopId: t.loopId,
      type: t.type,
      channel: t.channel,
      timestamp: t.timestamp,
      payload: (t.payload as Record<string, unknown> | null) ?? null,
    };
  }

  async listContacts(spaceId: string): Promise<ContactView[]> {
    const rows = await prisma.contact.findMany({ where: { spaceId, deletedAt: null } });
    return rows.map((c: ContactView) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      whatsapp: c.whatsapp,
      telephone: c.telephone,
      groupId: c.groupId,
    }));
  }

  async listGroups(spaceId: string): Promise<GroupView[]> {
    const rows = await prisma.group.findMany({ where: { spaceId } });
    return rows.map((g: GroupView) => ({ id: g.id, name: g.name }));
  }

  async listRoutines(userId: string): Promise<RoutineView[]> {
    const rows = await prisma.routine.findMany({ where: { userId, deletedAt: null } });
    return rows.map((r: RoutineView) => ({
      id: r.id,
      title: r.title,
      streakCount: r.streakCount,
      lastCheckedOn: r.lastCheckedOn,
      timezone: r.timezone,
    }));
  }

  async createRoutine(userId: string, title: string, timezone: string): Promise<RoutineView> {
    const r = await prisma.routine.create({ data: { userId, title, timezone } });
    return { id: r.id, title: r.title, streakCount: r.streakCount, lastCheckedOn: r.lastCheckedOn, timezone: r.timezone };
  }

  async checkRoutine(userId: string, routineId: string, now: Date): Promise<RoutineView> {
    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId } });
    if (!routine) throw new Error(`Routine ${routineId} not found`);
    const next = applyCheck({ streakCount: routine.streakCount, lastCheckedOn: routine.lastCheckedOn }, now, routine.timezone);
    const r = await prisma.routine.update({
      where: { id: routineId },
      data: { streakCount: next.streakCount, lastCheckedOn: next.lastCheckedOn },
    });
    // Record the per-day check (idempotent on the unique [routineId, checkedOn]).
    if (next.lastCheckedOn) {
      const day = new Date(Date.UTC(next.lastCheckedOn.getUTCFullYear(), next.lastCheckedOn.getUTCMonth(), next.lastCheckedOn.getUTCDate()));
      await prisma.routineCheck
        .upsert({ where: { routineId_checkedOn: { routineId, checkedOn: day } }, create: { routineId, checkedOn: day }, update: {} })
        .catch(() => undefined);
    }
    return { id: r.id, title: r.title, streakCount: r.streakCount, lastCheckedOn: r.lastCheckedOn, timezone: r.timezone };
  }
}
