import { LoopsClient } from '@/components/loops/LoopsClient';
import { CaptureFlow } from '@/components/loops/CaptureFlow';
import { BottomNav } from '@/components/ui/BottomNav';
import { getRepository, DEV_SPACE_ID, DEV_USER_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export default async function LoopsPage() {
  const repo = getRepository();
  const [loops, contacts, groups] = await Promise.all([
    repo.listLoops(DEV_SPACE_ID),
    repo.listContacts(DEV_SPACE_ID),
    repo.listGroups(DEV_SPACE_ID),
  ]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-44 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="text-h1 text-text">Loops</h1>
        <p className="mt-1 text-sm text-muted">Everything you’re waiting on, in one place.</p>
      </header>

      <LoopsClient loops={loops} contacts={contacts} groups={groups} userId={DEV_USER_ID} />

      <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
        <CaptureFlow contacts={contacts} />
      </div>
      <BottomNav />
    </main>
  );
}
