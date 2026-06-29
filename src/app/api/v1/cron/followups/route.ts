import { NextRequest } from 'next/server';
import { ok, fail, handle } from '@/lib/api';
import { getRepository, DEV_SPACE_ID } from '@/server/repositories';
import { dueFollowups } from '@/domain/reminders/reminders';

export const dynamic = 'force-dynamic';

/**
 * Background job (cron-triggered): find loops whose follow-up is due and surface them.
 * Idempotent. Authenticated with CRON_SECRET so it cannot be triggered by the public.
 *
 * MVP: computes due follow-ups and would reschedule + enqueue a reminder draft. Actual
 * notification dispatch (push/email) is wired in Step 7 once Resend/push exist — until then
 * this returns the due set so the schedule + logic are verifiable.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get('authorization');
    if (!secret) return fail('forbidden', 'CRON_SECRET is not configured');
    if (auth !== `Bearer ${secret}`) return fail('unauthorized', 'Invalid cron credentials');

    const repo = getRepository();
    const loops = await repo.listLoops(DEV_SPACE_ID);
    const due = dueFollowups(loops, new Date());

    // Step 7+: for each `due`, persist rescheduleTo, add a `reminded` Touch, dispatch the draft.
    return ok({
      processed: due.length,
      followups: due.map((d) => ({
        loopId: d.loopId,
        title: d.loopTitle,
        channel: d.channel,
        dueAt: d.dueAt.toISOString(),
        rescheduleTo: d.rescheduleTo.toISOString(),
      })),
    });
  });
}
