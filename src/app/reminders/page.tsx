import { RemindersView } from '@/components/reminders/RemindersView';
import { BottomNav } from '@/components/ui/BottomNav';
import { getRepository, DEV_SPACE_ID } from '@/server/repositories';
import { deriveReminders, bucketReminders, capPerLoopChannelDay } from '@/domain/reminders/reminders';
import { localDateKey, localParts } from '@/domain/time/tz';
import { DEV_TZ as TZ } from '@/lib/dev';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const repo = getRepository();
  const loops = await repo.listLoops(DEV_SPACE_ID);
  const now = new Date();

  const items = capPerLoopChannelDay(deriveReminders(loops), TZ);
  const buckets = bucketReminders(items, now, TZ);

  const countByDate: Record<string, number> = {};
  for (const item of items) {
    const k = localDateKey(item.dueAt, TZ);
    countByDate[k] = (countByDate[k] ?? 0) + 1;
  }

  const { year, month } = localParts(now, TZ);
  const todayKey = localDateKey(now, TZ);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="text-h1 text-text">Reminders</h1>
        <p className="mt-1 text-sm text-muted">Deadlines and follow-ups, in your timezone.</p>
      </header>

      <RemindersView
        year={year}
        month={month}
        todayKey={todayKey}
        countByDate={countByDate}
        buckets={buckets}
        tz={TZ}
      />
      <BottomNav />
    </main>
  );
}
