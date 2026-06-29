import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PlansClient } from '@/components/billing/PlansClient';

export const metadata = { title: 'Plans — Personal OS' };

export default function PlansPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/settings" className="pos-focus mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <header className="mb-6">
        <h1 className="text-h1 text-text">Plans</h1>
        <p className="mt-1 text-sm text-muted">Upgrade when you’re closing more than you can track.</p>
      </header>
      <PlansClient currentPlan="free" />
    </main>
  );
}
