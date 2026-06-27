import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { StatusDot, type LoopStatus } from '@/components/ui/StatusDot';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BottomNav } from '@/components/ui/BottomNav';
import { CaptureBar } from '@/components/ui/CaptureBar';

const statuses: LoopStatus[] = ['Awaiting', 'Responded', 'Blocked', 'Completed', 'Closed'];

/**
 * Step 0 placeholder home — a living preview of the black/white/gold design system.
 * Replaced by the real Dashboard in Step 6.
 */
export default function Home() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">Personal OS</p>
          <h1 className="text-display text-text">Get It Done.</h1>
        </div>
        <ThemeToggle />
      </header>

      <GlassCard className="mb-5 animate-fade-up">
        <p className="text-sm text-muted">This week</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="text-h1 text-gold">7</span>
          <span className="pb-1.5 text-sm text-muted">loops closed</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <span key={s} className="rounded-pill bg-[rgb(var(--pos-surface)/0.5)] px-3 py-1.5">
              <StatusDot status={s} />
            </span>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mb-5">
        <h2 className="text-h3 text-text">Components</h2>
        <p className="mt-1 text-sm text-muted">Buttons, chips, and inputs draw from shared tokens.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button variant="gold" size="sm">Confirm</Button>
          <Button variant="glass" size="sm">Edit</Button>
          <Button variant="ghost" size="sm">Skip</Button>
          <Button variant="danger" size="sm">Drop</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active>All</Chip>
          <Chip>By me</Chip>
          <Chip>Waiting</Chip>
          <Chip>Overdue</Chip>
        </div>
        <div className="mt-4">
          <Input placeholder="Filter by owner, status, deadline…" aria-label="Filter" />
        </div>
      </GlassCard>

      <p className="px-1 text-xs text-faint">
        Palette: black · white · gold. Gold is the reward colour.
      </p>

      <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
        <CaptureBar />
      </div>
      <BottomNav />
    </main>
  );
}
