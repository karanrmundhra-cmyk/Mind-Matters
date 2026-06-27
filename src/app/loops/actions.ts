'use server';

import { revalidatePath } from 'next/cache';
import { getRepository, DEV_SPACE_ID, DEV_USER_ID } from '@/server/repositories';
import { pathToClosed } from '@/domain/loop/stateMachine';
import type { LoopStatus } from '@/domain/enums';
import type { CreateLoopInput } from '@/app/loops/dto';

/**
 * Server actions for the Loops screen. They run against the active WorkspaceRepository
 * (in-memory today, Prisma when Supabase lands) — the screen code does not change when
 * the persistence layer is swapped.
 */

export async function closeLoopAction(loopId: string): Promise<void> {
  const repo = getRepository();
  const loop = await repo.getLoop(DEV_SPACE_ID, loopId);
  if (!loop) return;
  const path = pathToClosed(loop.status);
  if (!path) return;
  // Advance through each legal state — no skipping; every step is audit-logged.
  for (const next of path) {
    await repo.applyTransition(DEV_SPACE_ID, loopId, next, { byUserId: DEV_USER_ID });
  }
  revalidatePath('/loops');
  revalidatePath(`/loops/${loopId}`);
}

/** Persist a confirmed loop. Returns its id so the client can navigate to it. */
export async function createLoopAction(input: CreateLoopInput): Promise<string> {
  const repo = getRepository();
  const loop = await repo.createLoop({
    spaceId: DEV_SPACE_ID,
    createdById: DEV_USER_ID,
    title: input.title,
    ask: input.ask,
    definitionOfDone: input.definitionOfDone,
    deadline: input.deadlineIso ? new Date(input.deadlineIso) : null,
    priority: input.priority,
    channel: input.channel,
    source: 'manual',
    owners: input.owners,
    status: 'Confirmed',
  });
  revalidatePath('/loops');
  return loop.id;
}

export async function reorderLoopsAction(orderedIds: string[]): Promise<void> {
  await getRepository().reorderLoops(DEV_SPACE_ID, orderedIds);
  revalidatePath('/loops');
}

export async function advanceLoopAction(loopId: string, to: LoopStatus): Promise<void> {
  await getRepository().applyTransition(DEV_SPACE_ID, loopId, to, { byUserId: DEV_USER_ID });
  revalidatePath('/loops');
  revalidatePath(`/loops/${loopId}`);
}
