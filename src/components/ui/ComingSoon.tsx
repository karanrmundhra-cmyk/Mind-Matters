import { GlassCard } from '@/components/ui/GlassCard';
import { BottomNav } from '@/components/ui/BottomNav';

/** Honest placeholder for screens not yet built in this step. */
export function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-6 text-h1 text-text">{title}</h1>
      <GlassCard>
        <p className="text-sm text-muted">
          This screen is part of <span className="text-text">{step}</span> in the build plan and isn’t
          implemented yet.
        </p>
      </GlassCard>
      <BottomNav />
    </main>
  );
}
