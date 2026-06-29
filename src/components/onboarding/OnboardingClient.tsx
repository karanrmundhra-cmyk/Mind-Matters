'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { CaptureFlow } from '@/components/loops/CaptureFlow';
import type { ContactView } from '@/domain/loop/types';

type Step = 'intro' | 'signin' | 'first';

/**
 * Onboarding: intro → sign-in → guided first loop → dashboard. Google sign-in is gated
 * until Supabase Auth is configured; a demo path lets the flow proceed keyless.
 */
export function OnboardingClient({ contacts }: { contacts: ContactView[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      {step === 'intro' && (
        <div className="animate-fade-up text-center">
          <p className="text-sm text-muted">Personal OS</p>
          <h1 className="mt-1 text-display text-text">Get It Done.</h1>
          <p className="mx-auto mt-4 max-w-xs text-sm text-muted">
            The things you delegate, closed. Personal OS remembers what others owe you, drafts the
            nudge, and tracks the reply — so you don’t have to chase.
          </p>
          <Button variant="gold" className="mt-8 w-full" onClick={() => setStep('signin')}>
            Get started <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      {step === 'signin' && (
        <GlassCard className="animate-fade-up">
          <h1 className="text-h2 text-text">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Your loops sync securely to your account.</p>
          <Button variant="glass" className="mt-6 w-full" disabled>
            Continue with Google
          </Button>
          <p className="mt-2 text-center text-xs text-faint">
            Google sign-in activates once Supabase Auth is connected.
          </p>
          <Button variant="gold" className="mt-5 w-full" onClick={() => setStep('first')}>
            Continue in demo mode <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </GlassCard>
      )}

      {step === 'first' && (
        <div className="animate-fade-up">
          <h1 className="text-h2 text-text">Who owes you something?</h1>
          <p className="mt-1 mb-6 text-sm text-muted">
            Type it like you’d say it — e.g. “@Raj send the signed contract by Friday”. I’ll turn it
            into a tracked loop.
          </p>
          <div className="flex justify-center">
            <CaptureFlow contacts={contacts} />
          </div>
          <Button variant="ghost" className="mt-8 w-full" onClick={() => router.push('/')}>
            <Check className="h-4 w-4" aria-hidden /> Go to my dashboard
          </Button>
        </div>
      )}
    </main>
  );
}
