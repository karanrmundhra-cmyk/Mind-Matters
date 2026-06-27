import { cn } from '@/lib/cn';
import type { LoopStatus } from '@/domain/enums';

export type { LoopStatus };

/**
 * Accessibility rule: status is NEVER conveyed by colour alone. The dot is always
 * paired with a visible text label, and shape (filled vs. ringed) reinforces it.
 */
const styles: Record<LoopStatus, { dot: string; ring?: boolean; label: string }> = {
  Draft: { dot: 'bg-faint', label: 'Draft' },
  Confirmed: { dot: 'bg-text', label: 'Confirmed' },
  Scheduled: { dot: 'bg-text', ring: true, label: 'Scheduled' },
  Awaiting: { dot: 'bg-gold', ring: true, label: 'Awaiting' },
  Responded: { dot: 'bg-gold', label: 'Responded' },
  Blocked: { dot: 'bg-danger', ring: true, label: 'Blocked' },
  Escalated: { dot: 'bg-danger', label: 'Escalated' },
  Completed: { dot: 'bg-gold', label: 'Completed' },
  Closed: { dot: 'bg-gold', label: 'Closed' },
  Dropped: { dot: 'bg-faint', label: 'Dropped' },
  Archived: { dot: 'bg-faint', label: 'Archived' },
  Deleted: { dot: 'bg-faint', label: 'Deleted' },
};

export function StatusDot({
  status,
  showLabel = true,
  className,
}: {
  status: LoopStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const s = styles[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        aria-hidden
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-pill',
          s.dot,
          s.ring && 'ring-2 ring-offset-1 ring-offset-[var(--pos-bg)] ring-current opacity-90',
        )}
      />
      {showLabel ? (
        <span className="text-xs font-medium text-muted">{s.label}</span>
      ) : (
        <span className="sr-only">{s.label}</span>
      )}
    </span>
  );
}
