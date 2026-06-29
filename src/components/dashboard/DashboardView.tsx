import Link from 'next/link';
import { Flame, Sparkles, AlertTriangle, Clock, ArrowUpRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { Briefing, BriefItem } from '@/domain/briefing/briefing';

function BriefList({ items, max = 4 }: { items: BriefItem[]; max?: number }) {
  return (
    <ul className="space-y-1.5">
      {items.slice(0, max).map((it) => (
        <li key={it.loopId}>
          <Link
            href={`/loops/${it.loopId}`}
            className="pos-focus flex items-center justify-between gap-3 rounded-2xl px-1 py-1.5 hover:bg-[rgb(var(--pos-surface)/0.4)]"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-text">{it.title}</span>
            <span className="shrink-0 text-xs text-muted">{it.reason}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardView({
  greeting,
  briefing,
  streak,
}: {
  greeting: string;
  briefing: Briefing;
  streak: number;
}) {
  const escalations = briefing.suggestedEscalations;

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">{greeting}</p>
        <h1 className="text-display text-text">Get It Done.</h1>
      </header>

      {/* North Star: Weekly Closed Loops + streak */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <GlassCard>
          <p className="text-sm text-muted">Closed this week</p>
          <p className="mt-1 text-h1 text-gold">{briefing.wcl}</p>
        </GlassCard>
        <GlassCard className="flex flex-col justify-between">
          <p className="text-sm text-muted">Best streak</p>
          <p className="mt-1 inline-flex items-center gap-2 text-h1 text-text">
            <Flame className="h-6 w-6 text-gold" aria-hidden /> {streak}
          </p>
        </GlassCard>
      </div>

      {/* AI briefing */}
      <GlassCard className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">Today’s briefing</h2>
        </div>
        {escalations.length === 0 ? (
          <p className="text-sm text-muted">Nothing needs escalating. Nicely on top of things.</p>
        ) : (
          <>
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {escalations.length} loop
              {escalations.length > 1 ? 's' : ''} to escalate
            </p>
            <BriefList items={escalations} />
          </>
        )}
      </GlassCard>

      {/* Needs you today */}
      <GlassCard className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">Needs you today</h2>
        </div>
        {briefing.needsYouToday.length === 0 ? (
          <p className="text-sm text-muted">No deadlines today.</p>
        ) : (
          <BriefList items={briefing.needsYouToday} />
        )}
      </GlassCard>

      {/* Waiting on others */}
      <GlassCard className="mb-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-gold" aria-hidden />
            <h2 className="text-h3 text-text">Waiting on others</h2>
          </div>
          <Link href="/loops" className="pos-focus text-xs text-muted hover:text-text">
            All loops
          </Link>
        </div>
        {briefing.waitingOnOthers.length === 0 ? (
          <p className="text-sm text-muted">You’re not waiting on anyone right now.</p>
        ) : (
          <BriefList items={briefing.waitingOnOthers} max={5} />
        )}
      </GlassCard>
    </div>
  );
}
