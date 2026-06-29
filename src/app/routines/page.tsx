import { RoutinesClient } from '@/components/routines/RoutinesClient';
import { BottomNav } from '@/components/ui/BottomNav';
import { getRepository, DEV_USER_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export default async function RoutinesPage() {
  const routines = await getRepository().listRoutines(DEV_USER_ID);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="text-h1 text-text">Routines</h1>
        <p className="mt-1 text-sm text-muted">Daily habits that reset at midnight.</p>
      </header>

      <RoutinesClient routines={routines} />
      <BottomNav />
    </main>
  );
}
