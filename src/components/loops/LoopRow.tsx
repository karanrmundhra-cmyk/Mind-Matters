'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { cn } from '@/lib/cn';
import { CHANNEL_ICON, formatDeadline, initials, isOverdue } from '@/lib/format';
import { daysWaiting } from '@/domain/loop/filters';
import type { Loop } from '@/domain/loop/types';

/**
 * A loop row: tick-to-close · title · owner avatars · deadline chip · status dot+label
 * · channel icon · days-waiting. Tap the body to open detail; tap the circle to close.
 */
export function LoopRow({
  loop,
  onClose,
  now = new Date(),
}: {
  loop: Loop;
  onClose?: (id: string) => void;
  now?: Date;
}) {
  const [closing, setClosing] = useState(false);
  const ChannelIcon = loop.channel ? CHANNEL_ICON[loop.channel] : null;
  const deadlineLabel = formatDeadline(loop.deadline, now);
  const overdue = isOverdue(loop.deadline, now);
  const waited = daysWaiting(loop, now);
  const canClose = loop.status !== 'Closed' && loop.status !== 'Completed';

  function handleClose() {
    if (!canClose) return;
    setClosing(true);
    window.setTimeout(() => onClose?.(loop.id), 180);
  }

  return (
    <GlassCard flush className="flex items-center gap-3 p-3.5">
      <button
        type="button"
        onClick={handleClose}
        disabled={!canClose}
        aria-label={canClose ? `Mark “${loop.title}” closed` : 'Already closed'}
        className={cn(
          'pos-focus flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border transition-colors duration-pos ease-pos',
          loop.status === 'Closed' || loop.status === 'Completed'
            ? 'border-transparent bg-gold text-gold-on'
            : 'border-[rgb(var(--pos-border)/0.4)] text-transparent hover:border-gold',
          closing && 'pos-tick-anim border-transparent bg-gold text-gold-on',
        )}
      >
        <Check className="h-4 w-4" aria-hidden />
      </button>

      <Link href={`/loops/${loop.id}`} className="pos-focus min-w-0 flex-1 rounded-2xl">
        <p className="truncate text-[0.95rem] font-medium text-text">{loop.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusDot status={loop.status} />
          {deadlineLabel && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                overdue ? 'text-danger' : 'text-muted',
              )}
            >
              {deadlineLabel}
            </span>
          )}
          {waited > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3 w-3" aria-hidden /> {waited}d waiting
            </span>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {ChannelIcon && <ChannelIcon className="h-4 w-4 text-faint" aria-label={loop.channel ?? undefined} />}
        <div className="flex -space-x-2">
          {loop.owners.slice(0, 3).map((o) => (
            <span
              key={o.contactId}
              title={o.name}
              className="flex h-7 w-7 items-center justify-center rounded-pill border border-[var(--pos-bg)] bg-[rgb(var(--pos-surface)/0.85)] text-[0.6rem] font-semibold text-text"
            >
              {initials(o.name)}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
