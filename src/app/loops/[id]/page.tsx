import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Target } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { Timeline } from '@/components/loops/Timeline';
import { LoopActions } from '@/components/loops/LoopActions';
import { BottomNav } from '@/components/ui/BottomNav';
import { CHANNEL_ICON, formatDeadline, initials } from '@/lib/format';
import { getRepository, DEV_SPACE_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export default async function LoopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const loop = await repo.getLoop(DEV_SPACE_ID, id);
  if (!loop) notFound();
  const touches = await repo.listTouches(id);
  const ChannelIcon = loop.channel ? CHANNEL_ICON[loop.channel] : null;
  const deadlineLabel = formatDeadline(loop.deadline);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/loops" className="pos-focus mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Loops
      </Link>

      <GlassCard className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <StatusDot status={loop.status} />
          {deadlineLabel && <span className="text-xs text-muted">{deadlineLabel}</span>}
        </div>
        <h1 className="text-h2 text-text">{loop.title}</h1>
        <p className="mt-1 text-sm text-muted">{loop.ask}</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2">
            {loop.owners.map((o) => (
              <span
                key={o.contactId}
                title={o.name}
                className="flex h-8 w-8 items-center justify-center rounded-pill border border-[var(--pos-bg)] bg-[rgb(var(--pos-surface)/0.85)] text-xs font-semibold text-text"
              >
                {initials(o.name)}
              </span>
            ))}
          </div>
          <span className="text-sm text-muted">
            {loop.owners.map((o) => o.name).join(', ') || 'No owner'}
          </span>
          {ChannelIcon && <ChannelIcon className="ml-auto h-4 w-4 text-faint" aria-label={loop.channel ?? undefined} />}
        </div>
      </GlassCard>

      <GlassCard flush className="mb-4 flex items-start gap-3 p-4">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <div>
          <p className="text-xs font-medium text-muted">Done when</p>
          <p className="text-sm text-text">{loop.definitionOfDone}</p>
        </div>
      </GlassCard>

      <GlassCard className="mb-4">
        <h2 className="mb-4 text-h3 text-text">Timeline</h2>
        <Timeline touches={touches} />
      </GlassCard>

      <LoopActions loopId={loop.id} status={loop.status} />
      <BottomNav />
    </main>
  );
}
