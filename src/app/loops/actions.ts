'use server';

import { revalidatePath } from 'next/cache';
import { getRepository, DEV_SPACE_ID, DEV_USER_ID } from '@/server/repositories';
import { pathToClosed } from '@/domain/loop/stateMachine';
import type { LoopStatus, Channel } from '@/domain/enums';
import type { CreateLoopInput } from '@/app/loops/dto';
import { getProvider } from '@/ai';
import { buildSendLink } from '@/domain/send/links';
import { track } from '@/lib/analytics';

/** Legal sequence to reach Awaiting (waiting on a reply) after an assisted send. */
function pathToAwaiting(from: LoopStatus): LoopStatus[] {
  switch (from) {
    case 'Confirmed':
      return ['Scheduled', 'Awaiting'];
    case 'Scheduled':
      return ['Awaiting'];
    default:
      return [];
  }
}

export interface SendResult {
  ok: boolean;
  href?: string;
  message?: string;
  reason?: string;
}

/**
 * Assisted send: draft a message in the user's voice, return a deep link the user's own
 * client opens (mailto/tel/wa.me), log the timeline, and move the loop to Awaiting.
 * Nothing is sent autonomously by the server.
 */
export async function sendLoopAction(loopId: string, channel: Channel): Promise<SendResult> {
  const repo = getRepository();
  const loop = await repo.getLoop(DEV_SPACE_ID, loopId);
  if (!loop) return { ok: false, reason: 'Loop not found' };
  const owner = loop.owners[0];
  if (!owner) return { ok: false, reason: 'No owner to contact' };

  const contacts = await repo.listContacts(DEV_SPACE_ID);
  const contact = contacts.find((c) => c.id === owner.contactId);
  if (!contact) return { ok: false, reason: 'Contact details missing' };

  const message = await getProvider().draftMessage({
    ask: loop.ask,
    ownerName: owner.name,
    channel,
  });
  const link = buildSendLink(
    channel,
    { email: contact.email, phone: contact.telephone, whatsapp: contact.whatsapp },
    loop.title,
    message,
  );
  if (!link) return { ok: false, reason: `Can't ${channel} ${owner.name} — missing contact detail` };

  await repo.addTouch(loopId, { type: 'drafted', channel, payload: { preview: message.slice(0, 120) } });
  await repo.addTouch(loopId, { type: 'sent', channel });
  for (const next of pathToAwaiting(loop.status)) {
    await repo.applyTransition(DEV_SPACE_ID, loopId, next, { byUserId: DEV_USER_ID });
  }
  track('channel_used', { loopId, channel });
  revalidatePath(`/loops/${loopId}`);
  revalidatePath('/loops');
  return { ok: true, href: link.href, message };
}

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
  track('loop_closed', { loopId });
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
  track('loop_created', { loopId: loop.id, priority: input.priority, channel: input.channel });
  track('loop_confirmed', { loopId: loop.id });
  revalidatePath('/loops');
  return loop.id;
}

export async function reorderLoopsAction(orderedIds: string[]): Promise<void> {
  await getRepository().reorderLoops(DEV_SPACE_ID, orderedIds);
  revalidatePath('/loops');
}

export async function advanceLoopAction(loopId: string, to: LoopStatus): Promise<void> {
  await getRepository().applyTransition(DEV_SPACE_ID, loopId, to, { byUserId: DEV_USER_ID });
  if (to === 'Dropped') track('loop_dropped', { loopId });
  revalidatePath('/loops');
  revalidatePath(`/loops/${loopId}`);
}
