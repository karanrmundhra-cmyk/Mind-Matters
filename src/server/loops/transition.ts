import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { planTransition, type TransitionOptions } from '@/domain/loop/service';
import { LoopNotFoundError, OptimisticLockError } from '@/domain/errors';
import type { LoopStatus } from '@/domain/enums';

/**
 * Apply a status transition atomically:
 *  1. plan the transition (state-machine enforced, timestamps derived)
 *  2. optimistic-locked update (version guard) — concurrent edits throw
 *  3. write the transition history row, the timeline Touch, and the audit log
 * All inside one DB transaction.
 */
export async function transitionLoop(
  loopId: string,
  spaceId: string,
  to: LoopStatus,
  opts: TransitionOptions = {},
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const loop = await tx.loop.findFirst({
      where: { id: loopId, spaceId },
      select: {
        id: true,
        version: true,
        status: true,
        priority: true,
        followupPolicyDays: true,
        waitingSince: true,
      },
    });
    if (!loop) throw new LoopNotFoundError(loopId);

    const plan = planTransition(loop, to, opts);

    const result = await tx.loop.updateMany({
      where: { id: loopId, spaceId, version: loop.version },
      data: { ...plan.updates, version: { increment: 1 } },
    });
    if (result.count === 0) throw new OptimisticLockError(loopId);

    await tx.loopTransition.create({
      data: {
        loopId,
        fromStatus: plan.transition.fromStatus,
        toStatus: plan.transition.toStatus,
        byUserId: plan.transition.byUserId,
        reason: plan.transition.reason,
      },
    });

    await tx.touch.create({
      data: { loopId, type: plan.touch.type, payload: plan.touch.payload },
    });

    await tx.auditLog.create({
      data: {
        spaceId,
        userId: opts.byUserId ?? null,
        action: 'loop.transition',
        entity: 'Loop',
        entityId: loopId,
        data: { from: plan.transition.fromStatus, to: plan.transition.toStatus },
      },
    });

    return tx.loop.findUniqueOrThrow({ where: { id: loopId } });
  });
}
