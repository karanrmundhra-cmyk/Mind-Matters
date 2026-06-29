import { handle } from '@/lib/api';
import { getRepository, DEV_SPACE_ID, DEV_USER_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

/**
 * One-click JSON export of the user's data (DPDP: the user owns their data).
 * Returns the full workspace — loops + timelines, contacts, groups, routines — as a download.
 */
export async function GET() {
  return handle(async () => {
    const repo = getRepository();
    const [loops, contacts, groups, routines] = await Promise.all([
      repo.listLoops(DEV_SPACE_ID),
      repo.listContacts(DEV_SPACE_ID),
      repo.listGroups(DEV_SPACE_ID),
      repo.listRoutines(DEV_USER_ID),
    ]);

    const loopsWithTimeline = await Promise.all(
      loops.map(async (loop) => ({ ...loop, touches: await repo.listTouches(loop.id) })),
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      userId: DEV_USER_ID,
      spaceId: DEV_SPACE_ID,
      loops: loopsWithTimeline,
      contacts,
      groups,
      routines,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="personal-os-export-${Date.now()}.json"`,
      },
    });
  });
}
