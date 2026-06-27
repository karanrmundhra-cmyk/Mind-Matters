import { GlassCard } from '@/components/ui/GlassCard';

export const metadata = { title: 'Offline — Personal OS' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <GlassCard>
        <h1 className="text-h2 text-text">You’re offline</h1>
        <p className="mt-2 text-sm text-muted">
          Personal OS will reconnect automatically. Anything you capture while offline is queued and
          syncs the moment you’re back online.
        </p>
      </GlassCard>
    </main>
  );
}
