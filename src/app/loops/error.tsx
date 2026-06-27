'use client';

import { useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';

/** Inline error state for the Loops route with a retry. */
export default function LoopsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Real logging/Sentry hook lands in Step 10.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <GlassCard className="text-center">
        <h1 className="text-h3 text-text">Couldn’t load your loops</h1>
        <p className="mt-2 text-sm text-muted">Something went wrong. Your data is safe.</p>
        <div className="mt-5 flex justify-center">
          <Button variant="gold" onClick={reset}>
            Try again
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}
