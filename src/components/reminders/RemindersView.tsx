import Link from 'next/link';
import { CalendarDays, BellRing, Flag } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CHANNEL_ICON } from '@/lib/format';
import { cn } from '@/lib/cn';
import { monthGrid, WEEKDAY_LABELS } from '@/domain/reminders/calendar';
import type { ReminderBuckets, ReminderItem } from '@/domain/reminders/reminders';

function fmtTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function ReminderRow({ item, tz }: { item: ReminderItem; tz: string }) {
  const Icon = item.kind === 'deadline' ? Flag : BellRing;
  const ChannelIcon = item.channel ? CHANNEL_ICON[item.channel] : null;
  return (
    <Link
      href={`/loops/${item.loopId}`}
      className="pos-focus flex items-center gap-3 rounded-2xl px-1.5 py-2 hover:bg-[rgb(var(--pos-surface)/0.4)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-[rgb(var(--pos-surface)/0.8)] text-gold">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{item.loopTitle}</span>
        <span className="block text-xs text-muted">
          {item.kind === 'deadline' ? 'Deadline' : 'Follow-up'} · {fmtTime(item.dueAt, tz)}
        </span>
      </span>
      {ChannelIcon && <ChannelIcon className="h-4 w-4 shrink-0 text-faint" aria-hidden />}
    </Link>
  );
}

function Section({ title, items, tz, danger }: { title: string; items: ReminderItem[]; tz: string; danger?: boolean }) {
  if (items.length === 0) return null;
  return (
    <GlassCard className="mb-4">
      <h2 className={cn('mb-2 text-h3', danger ? 'text-danger' : 'text-text')}>
        {title} <span className="text-sm font-normal text-muted">· {items.length}</span>
      </h2>
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <ReminderRow key={`${item.loopId}-${item.kind}-${i}`} item={item} tz={tz} />
        ))}
      </div>
    </GlassCard>
  );
}

export function RemindersView({
  year,
  month,
  todayKey,
  countByDate,
  buckets,
  tz,
}: {
  year: number;
  month: number;
  todayKey: string;
  countByDate: Record<string, number>;
  buckets: ReminderBuckets;
  tz: string;
}) {
  const grid = monthGrid(year, month);
  const empty = buckets.overdue.length + buckets.today.length + buckets.upcoming.length === 0;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div>
      <GlassCard className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gold" aria-hidden />
          <h2 className="text-h3 text-text">{monthLabel}</h2>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((w, i) => (
            <span key={i} className="pb-1 text-[0.65rem] font-medium text-faint">
              {w}
            </span>
          ))}
          {grid.flat().map((cell) => {
            const count = countByDate[cell.dateKey] ?? 0;
            const isToday = cell.dateKey === todayKey;
            return (
              <div
                key={cell.dateKey}
                className={cn(
                  'relative flex h-9 flex-col items-center justify-center rounded-xl text-sm',
                  cell.inMonth ? 'text-text' : 'text-faint/50',
                  isToday && 'bg-gold text-gold-on font-semibold',
                )}
              >
                {cell.day}
                {count > 0 && !isToday && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-pill bg-gold" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <Section title="Overdue" items={buckets.overdue} tz={tz} danger />
      <Section title="Today" items={buckets.today} tz={tz} />
      <Section title="Upcoming" items={buckets.upcoming} tz={tz} />

      {empty && (
        <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
          <BellRing className="h-6 w-6 text-faint" aria-hidden />
          <p className="text-sm text-muted">No reminders. You’re all caught up.</p>
        </GlassCard>
      )}
    </div>
  );
}
