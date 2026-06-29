import { DashboardView } from '@/components/dashboard/DashboardView';
import { CaptureFlow } from '@/components/loops/CaptureFlow';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BottomNav } from '@/components/ui/BottomNav';
import { getRepository, DEV_SPACE_ID, DEV_USER_ID } from '@/server/repositories';
import { buildBriefing } from '@/domain/briefing/briefing';
import { displayStreak } from '@/domain/routines/streak';
import { localParts } from '@/domain/time/tz';
import { DEV_TZ as TZ } from '@/lib/dev';

export const dynamic = 'force-dynamic';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function Home() {
  const repo = getRepository();
  const now = new Date();
  const [loops, contacts, routines] = await Promise.all([
    repo.listLoops(DEV_SPACE_ID),
    repo.listContacts(DEV_SPACE_ID),
    repo.listRoutines(DEV_USER_ID),
  ]);

  const briefing = buildBriefing(loops, now, TZ);
  const streak = routines.reduce(
    (m, r) => Math.max(m, displayStreak({ streakCount: r.streakCount, lastCheckedOn: r.lastCheckedOn }, now, TZ)),
    0,
  );
  const greeting = greetingFor(localParts(now, TZ).hour);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-44 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <DashboardView greeting={greeting} briefing={briefing} streak={streak} />

      <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
        <CaptureFlow contacts={contacts} />
      </div>
      <BottomNav />
    </main>
  );
}
